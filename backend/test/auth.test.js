import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
  app = createApp({ db, sessionTtlMs: 24 * 60 * 60 * 1000 });
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

test("registers a user, creates a session, and returns the profile", async () => {
  const agent = request.agent(app);
  const registration = await agent.post("/api/auth/register").send({
    username: "KermitFan",
    email: "fan@example.com",
    password: "StrongPass123",
  });

  assert.equal(registration.status, 201);
  assert.equal(registration.body.user.username, "KermitFan");
  assert.equal(registration.body.user.email, "fan@example.com");
  assert.equal("password_hash" in registration.body.user, false);
  assert.match(registration.headers["set-cookie"][0], /HttpOnly/);
  assert.match(registration.headers["set-cookie"][0], /SameSite=Strict/);

  const profile = await agent.get("/api/auth/me");
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.username, "KermitFan");
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
