import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/database/index.js";

let db;
let app;
let testDirectory;
const sentEmails = [];

function latestTokenFor(email) {
  const message = [...sentEmails].reverse().find((item) => item.to === email);
  assert.ok(message, `Expected a verification email for ${email}`);
  return new URL(message.verificationUrl).searchParams.get("token");
}

before(async () => {
  const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  testDirectory = mkdtempSync(path.join(tmpdir(), "shkermit-test-"));
  const databaseUrl = `file:${path.join(testDirectory, "test.sqlite")}`;

  execFileSync(
    process.execPath,
    [path.join(backendDirectory, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      cwd: backendDirectory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    },
  );

  db = createDatabase(databaseUrl);
  app = createApp({
    db,
    sessionTtlMs: 24 * 60 * 60 * 1000,
    emailVerificationTtlMs: 60 * 60 * 1000,
    appUrl: "http://localhost:5173",
    mailer: {
      async sendVerificationEmail(message) {
        sentEmails.push(message);
      },
    },
    adminEmails: ["admin@example.com"],
    pictureUploadDirectory: path.join(testDirectory, "files", "pictures"),
  });
});

after(async () => {
  await db.$disconnect();
  rmSync(testDirectory, { recursive: true, force: true });
});

test("reports API health", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("stores an authenticated best score independently for every game mode", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({
    username: "ScoreFrog",
    email: "scores@example.com",
    password: "StrongPass123",
  });
  await agent.post("/api/auth/verify-email").send({
    token: latestTokenFor("scores@example.com"),
  });

  const initial = await agent.get("/api/scores/tetris/solo");
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body, { game: "tetris", mode: "solo", score: 0 });

  assert.equal((await agent.put("/api/scores/tetris/solo").send({ score: 420 })).status, 200);
  const lowerScore = await agent.put("/api/scores/tetris/solo").send({ score: 12 });
  assert.equal(lowerScore.body.score, 420);

  const otherMode = await agent.put("/api/scores/snake/classic").send({ score: 150 });
  assert.equal(otherMode.body.score, 150);
  assert.equal((await agent.get("/api/scores/tetris/solo")).body.score, 420);
  assert.equal((await agent.get("/api/scores/snake/classic")).body.score, 150);
  assert.equal((await agent.put("/api/scores/tetris/duel").send({ score: 999 })).status, 403);

  const leaderboards = await request(app).get("/api/scores/leaderboard");
  assert.equal(leaderboards.status, 200);
  assert.equal(leaderboards.body.leaderboards.length, 5);
  const soloBoard = leaderboards.body.leaderboards.find(
    (board) => board.game === "tetris" && board.mode === "solo",
  );
  assert.deepEqual(soloBoard.entries[0], {
    rank: 1,
    username: "ScoreFrog",
    score: 420,
  });

  assert.equal((await agent.put("/api/scores/snake/classic").send({ score: -1 })).status, 400);
  assert.equal((await agent.get("/api/scores/unknown/classic")).status, 400);
  assert.equal((await request(app).get("/api/scores/tetris/solo")).status, 401);
});

test("registers a user and requires email confirmation before creating a session", async () => {
  const agent = request.agent(app);
  const registration = await agent.post("/api/auth/register").send({
    username: "KermitFan",
    email: "fan@example.com",
    password: "StrongPass123",
  });

  assert.equal(registration.status, 201);
  assert.equal(registration.body.email, "fan@example.com");
  assert.equal(registration.headers["set-cookie"], undefined);
  assert.equal((await agent.get("/api/auth/me")).status, 401);

  const blockedLogin = await agent.post("/api/auth/login").send({
    identifier: "fan@example.com",
    password: "StrongPass123",
  });
  assert.equal(blockedLogin.status, 403);
  assert.equal(blockedLogin.body.code, "EMAIL_NOT_VERIFIED");

  const confirmation = await agent.post("/api/auth/verify-email").send({
    token: latestTokenFor("fan@example.com"),
  });
  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.body.user.username, "KermitFan");
  assert.equal(confirmation.body.user.emailVerified, true);
  assert.equal("passwordHash" in confirmation.body.user, false);
  assert.match(confirmation.headers["set-cookie"][0], /HttpOnly/);
  assert.match(confirmation.headers["set-cookie"][0], /SameSite=Strict/);

  const profile = await agent.get("/api/auth/me");
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.username, "KermitFan");
});

test("verification links are single-use and resend responses do not reveal accounts", async () => {
  const usedToken = latestTokenFor("fan@example.com");
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: usedToken })).status, 400);

  await request(app).post("/api/auth/register").send({
    username: "PendingFan",
    email: "pending@example.com",
    password: "StrongPass123",
  });
  const originalToken = latestTokenFor("pending@example.com");
  const known = await request(app)
    .post("/api/auth/resend-verification")
    .send({ email: "pending@example.com" });
  const unknown = await request(app)
    .post("/api/auth/resend-verification")
    .send({ email: "nobody@example.com" });
  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.deepEqual(known.body, unknown.body);

  const replacementToken = latestTokenFor("pending@example.com");
  assert.notEqual(replacementToken, originalToken);
  assert.equal(
    (await request(app).post("/api/auth/verify-email").send({ token: originalToken })).status,
    400,
  );
  assert.equal(
    (await request(app).post("/api/auth/verify-email").send({ token: replacementToken })).status,
    200,
  );
});

test("rejects duplicate identities regardless of case", async () => {
  const response = await request(app).post("/api/auth/register").send({
    username: "kermitfan",
    email: "another@example.com",
    password: "StrongPass123",
  });

  assert.equal(response.status, 409);
});

test("validates passwords and rejects bad credentials", async () => {
  const weak = await request(app).post("/api/auth/register").send({
    username: "WeakUser",
    email: "weak@example.com",
    password: "password",
  });
  assert.equal(weak.status, 400);

  const login = await request(app).post("/api/auth/login").send({
    identifier: "fan@example.com",
    password: "not-the-password",
  });
  assert.equal(login.status, 401);
});

test("logs in by email and logs out", async () => {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({
    identifier: "FAN@EXAMPLE.COM",
    password: "StrongPass123",
  });
  assert.equal(login.status, 200);

  const logout = await agent.post("/api/auth/logout");
  assert.equal(logout.status, 204);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
});

test("updates profile and password while invalidating older sessions", async () => {
  const oldAgent = request.agent(app);
  const currentAgent = request.agent(app);
  await oldAgent.post("/api/auth/login").send({ identifier: "KermitFan", password: "StrongPass123" });
  await currentAgent.post("/api/auth/login").send({ identifier: "KermitFan", password: "StrongPass123" });

  const update = await currentAgent.patch("/api/account").send({
    username: "SwampFan",
    email: "swamp@example.com",
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.user.username, "SwampFan");
  assert.equal(update.body.user.emailVerified, false);

  const reconfirmation = await currentAgent.post("/api/auth/verify-email").send({
    token: latestTokenFor("swamp@example.com"),
  });
  assert.equal(reconfirmation.status, 200);
  assert.equal(reconfirmation.body.user.emailVerified, true);

  const passwordUpdate = await currentAgent.put("/api/account/password").send({
    currentPassword: "StrongPass123",
    newPassword: "EvenStronger456",
  });
  assert.equal(passwordUpdate.status, 200);
  assert.equal((await oldAgent.get("/api/auth/me")).status, 401);
  assert.equal((await currentAgent.get("/api/auth/me")).status, 200);

  const oldPassword = await request(app).post("/api/auth/login").send({
    identifier: "SwampFan",
    password: "StrongPass123",
  });
  assert.equal(oldPassword.status, 401);
});

test("lets administrators manage pictures while protecting write operations", async () => {
  const publicGallery = await request(app).get("/api/pictures");
  assert.equal(publicGallery.status, 200);
  assert.equal(publicGallery.body.pictures.length, 12);
  assert.equal(publicGallery.body.pictures[0].assetKey, "img1");

  const regularAgent = request.agent(app);
  await regularAgent.post("/api/auth/login").send({
    identifier: "SwampFan",
    password: "EvenStronger456",
  });
  assert.equal(
    (await regularAgent.delete(`/api/pictures/${publicGallery.body.pictures[0].id}`)).status,
    403,
  );

  const adminAgent = request.agent(app);
  await adminAgent.post("/api/auth/register").send({
    username: "GalleryAdmin",
    email: "admin@example.com",
    password: "AdminPassword123",
  });
  const verification = await adminAgent.post("/api/auth/verify-email").send({
    token: latestTokenFor("admin@example.com"),
  });
  assert.equal(verification.status, 200);
  assert.equal(verification.body.user.isAdmin, true);

  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const created = await adminAgent
    .post("/api/pictures")
    .field("title", "Test picture")
    .field("altText", "A test gallery picture")
    .attach("image", image, { filename: "test.png", contentType: "image/png" });
  assert.equal(created.status, 201);
  assert.equal(created.body.picture.title, "Test picture");
  assert.equal(created.body.picture.position, 12);
  const storedPicture = await db.picture.findUnique({ where: { id: created.body.picture.id } });
  assert.ok(storedPicture.storageKey);
  const storedFile = path.join(testDirectory, "files", "pictures", storedPicture.storageKey);
  assert.equal(existsSync(storedFile), true);

  const content = await request(app).get(`/api/pictures/${created.body.picture.id}/content`);
  assert.equal(content.status, 200);
  assert.equal(content.headers["content-type"], "image/png");
  assert.deepEqual(content.body, image);

  const updated = await adminAgent
    .patch(`/api/pictures/${created.body.picture.id}`)
    .field("title", "Updated picture")
    .field("altText", "Updated alternative text");
  assert.equal(updated.status, 200);
  assert.equal(updated.body.picture.title, "Updated picture");

  const moved = await adminAgent
    .patch(`/api/pictures/${created.body.picture.id}/position`)
    .send({ direction: "up" });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.pictures[11].id, created.body.picture.id);
  assert.equal(moved.body.pictures[11].position, 11);

  assert.equal((await adminAgent.delete(`/api/pictures/${created.body.picture.id}`)).status, 204);
  assert.equal(existsSync(storedFile), false);
  assert.equal((await request(app).get(`/api/pictures/${created.body.picture.id}/content`)).status, 404);
});

test("requires a password before deleting an account", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({
    identifier: "SwampFan",
    password: "EvenStronger456",
  });

  assert.equal((await agent.delete("/api/account").send({ password: "wrong" })).status, 401);
  assert.equal((await agent.delete("/api/account").send({ password: "EvenStronger456" })).status, 204);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
});
