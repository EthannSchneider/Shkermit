import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/database/index.js";

let db, app, directory, admin, adminId;
const emails = [];
let failMail = false;
const tokenFor = (email) => new URL(emails.findLast((item) => item.to === email).verificationUrl).searchParams.get("token");

async function register(username, { verified = true, email = `${username.toLowerCase()}@example.com` } = {}) {
  const agent = request.agent(app);
  assert.equal((await agent.post("/api/auth/register").send({ username, email, password: "StrongPass123" })).status, 201);
  let id;
  if (verified) {
    const result = await agent.post("/api/auth/verify-email").send({ token: tokenFor(email) });
    assert.equal(result.status, 200);
    id = result.body.user.id;
  } else {
    id = (await db.user.findUnique({ where: { email } })).id;
  }
  return { agent, id, email };
}

before(async () => {
  const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  directory = mkdtempSync(path.join(tmpdir(), "shkermit-admin-test-"));
  const databaseUrl = `file:${path.join(directory, "test.sqlite")}`;
  execFileSync(process.execPath, [path.join(backendDirectory, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: backendDirectory, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe",
  });
  db = createDatabase(databaseUrl);
  app = createApp({
    db, sessionTtlMs: 86400000, emailVerificationTtlMs: 3600000, appUrl: "http://localhost:5173",
    adminEmails: ["admin@example.com", "owner@example.com"],
    pictureUploadDirectory: path.join(directory, "pictures"),
    mailer: { async sendVerificationEmail(message) {
      if (failMail) throw new Error("Test delivery failure");
      emails.push(message);
    } },
  });
  const account = await register("UserAdmin", { email: "admin@example.com" });
  admin = account.agent;
  adminId = account.id;
});

after(async () => {
  await db?.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

test("all user management endpoints require a verified administrator", async () => {
  const { agent, id } = await register("RegularFrog");
  const actions = [
    (client) => client.get("/api/admin/users"),
    (client) => client.patch(`/api/admin/users/${id}`).send({ username: "Changed", email: "changed@example.com" }),
    (client) => client.patch(`/api/admin/users/${id}/suspension`).send({ suspended: true }),
    (client) => client.post(`/api/admin/users/${id}/resend-verification`),
    (client) => client.post(`/api/admin/users/${id}/confirm-email`).send({ email: "regularfrog@example.com" }),
    (client) => client.delete(`/api/admin/users/${id}`),
  ];
  for (const action of actions) {
    assert.equal((await action(request(app))).status, 401);
    assert.equal((await action(agent)).status, 403);
  }
});

test("protects current, other, and unconfirmed admin accounts and prevents assigning admin emails", async () => {
  const pendingAdmin = await register("PendingOwner", { email: "owner@example.com", verified: false });
  for (const id of [adminId, pendingAdmin.id]) {
    assert.equal((await admin.delete(`/api/admin/users/${id}`)).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${id}/suspension`).send({ suspended: true })).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${id}`).send({ username: "Changed", email: "changed@example.com" })).status, 403);
    assert.equal((await admin.post(`/api/admin/users/${id}/resend-verification`)).status, 403);
    assert.equal((await admin.post(`/api/admin/users/${id}/confirm-email`).send({ email: id === adminId ? "admin@example.com" : "owner@example.com" })).status, 403);
  }
  const normal = await register("NoPrivilege");
  assert.equal((await admin.patch(`/api/admin/users/${normal.id}`).send({ username: "NoPrivilege", email: "ADMIN@example.com" })).status, 403);
  const list = await admin.get("/api/admin/users?search=owner");
  assert.equal(list.body.users[0].isAdmin, false);
  assert.equal(list.body.users[0].canManage, false);
});

test("suspension revokes every session, blocks login, and reactivation requires fresh login", async () => {
  const { agent, id, email } = await register("SuspendFrog");
  const second = request.agent(app);
  await second.post("/api/auth/login").send({ identifier: email, password: "StrongPass123" });
  await agent.put("/api/scores/snake/classic").send({ score: 123 });
  assert.equal(await db.session.count({ where: { userId: id } }), 2);
  const suspend = await admin.patch(`/api/admin/users/${id}/suspension`).send({ suspended: true });
  assert.equal(suspend.status, 200);
  assert.equal(suspend.body.user.isSuspended, true);
  assert.equal(await db.session.count({ where: { userId: id } }), 0);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
  assert.equal((await second.put("/api/scores/snake/classic").send({ score: 456 })).status, 401);
  const login = await agent.post("/api/auth/login").send({ identifier: email, password: "StrongPass123" });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, "ACCOUNT_SUSPENDED");
  const restore = await admin.patch(`/api/admin/users/${id}/suspension`).send({ suspended: false });
  assert.equal(restore.status, 200);
  assert.equal(restore.body.user.isSuspended, false);
  assert.equal((await second.get("/api/auth/me")).status, 401);
  assert.equal((await agent.post("/api/auth/login").send({ identifier: email, password: "StrongPass123" })).status, 200);
  assert.equal((await agent.get("/api/scores/snake/classic")).body.score, 123);
});

test("suspension blocks persisted sessions and email verification cannot create a session", async () => {
  const loggedIn = await register("PersistedFrog");
  await db.user.update({ where: { id: loggedIn.id }, data: { suspendedAt: new Date() } });
  const denied = await loggedIn.agent.get("/api/auth/me");
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, "ACCOUNT_SUSPENDED");
  const pending = await register("SuspendedPending", { verified: false });
  await admin.patch(`/api/admin/users/${pending.id}/suspension`).send({ suspended: true });
  const verified = await pending.agent.post("/api/auth/verify-email").send({ token: tokenFor(pending.email) });
  assert.equal(verified.status, 403);
  assert.equal(verified.body.code, "ACCOUNT_SUSPENDED");
  assert.equal(verified.headers["set-cookie"], undefined);
  assert.equal(await db.session.count({ where: { userId: pending.id } }), 0);
  await admin.patch(`/api/admin/users/${pending.id}/suspension`).send({ suspended: false });
  assert.equal((await pending.agent.post("/api/auth/login").send({ identifier: pending.email, password: "StrongPass123" })).status, 200);
});

test("editing email resets confirmation, invalidates sessions and old links, and requires the new link", async () => {
  const original = await register("EditFrog");
  const edited = await admin.patch(`/api/admin/users/${original.id}`).send({ username: "RenamedFrog", email: " NEW-EMAIL@example.com " });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.user.username, "RenamedFrog");
  assert.equal(edited.body.user.email, "new-email@example.com");
  assert.equal(edited.body.user.emailVerified, false);
  assert.equal((await original.agent.get("/api/auth/me")).status, 401);
  assert.equal((await original.agent.post("/api/auth/login").send({ identifier: "RenamedFrog", password: "StrongPass123" })).status, 403);
  assert.equal((await original.agent.post("/api/auth/verify-email").send({ token: tokenFor("new-email@example.com") })).status, 200);

  const pending = await register("EditPending", { verified: false });
  const staleToken = tokenFor(pending.email);
  await admin.patch(`/api/admin/users/${pending.id}`).send({ username: "EditPending", email: "changed-pending@example.com" });
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: staleToken })).status, 400);
  const currentToken = tokenFor("changed-pending@example.com");
  assert.equal((await admin.post(`/api/admin/users/${pending.id}/resend-verification`)).status, 200);
  assert.notEqual(currentToken, tokenFor("changed-pending@example.com"));
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: currentToken })).status, 400);
  assert.equal((await admin.post(`/api/admin/users/${original.id}/resend-verification`)).status, 400);
});

test("admins can confirm email manually without creating a session or retaining confirmation links", async () => {
  const pending = await register("ManualConfirm", { verified: false });
  const staleToken = tokenFor(pending.email);
  const emailCount = emails.length;
  const result = await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({ email: pending.email });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.emailVerified, true);
  assert.equal(result.body.user.isAdmin, false);
  assert.equal(result.headers["set-cookie"], undefined);
  assert.equal(emails.length, emailCount);
  assert.equal(await db.session.count({ where: { userId: pending.id } }), 0);
  assert.equal(await db.emailVerificationToken.count({ where: { userId: pending.id } }), 0);
  assert.equal((await admin.get("/api/auth/me")).body.user.id, adminId);
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: staleToken })).status, 400);
  const repeated = await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({ email: pending.email });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.user.updatedAt, result.body.user.updatedAt);
  assert.equal((await pending.agent.post("/api/auth/login").send({ identifier: pending.email, password: "StrongPass123" })).status, 200);
  const list = await admin.get("/api/admin/users?search=ManualConfirm");
  assert.equal(list.body.users[0].emailVerified, true);
});

test("manual email confirmation preserves suspension", async () => {
  const pending = await register("ManualSuspended", { verified: false });
  await admin.patch(`/api/admin/users/${pending.id}/suspension`).send({ suspended: true });
  const result = await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({ email: pending.email });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.emailVerified, true);
  assert.equal(result.body.user.isSuspended, true);
  const login = await pending.agent.post("/api/auth/login").send({ identifier: pending.email, password: "StrongPass123" });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, "ACCOUNT_SUSPENDED");
});

test("manual confirmation rejects invalid, missing, and changed email addresses", async () => {
  const pending = await register("ManualChanged", { verified: false });
  assert.equal((await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({})).status, 400);
  assert.equal((await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({ email: "invalid" })).status, 400);
  assert.equal((await admin.post("/api/admin/users/abc/confirm-email").send({ email: pending.email })).status, 400);
  assert.equal((await admin.post("/api/admin/users/999999/confirm-email").send({ email: pending.email })).status, 404);
  await admin.patch(`/api/admin/users/${pending.id}`).send({ username: "ManualChanged", email: "manual-changed@example.com" });
  assert.equal((await admin.post(`/api/admin/users/${pending.id}/confirm-email`).send({ email: pending.email })).status, 409);
  const stored = await db.user.findUnique({ where: { id: pending.id } });
  assert.equal(stored.emailVerifiedAt, null);
  assert.equal(await db.emailVerificationToken.count({ where: { userId: pending.id } }), 1);
});

test("deleting users cascades to sessions, email tokens, and scores", async () => {
  const target = await register("DeleteFrog");
  await target.agent.put("/api/scores/snake/classic").send({ score: 321 });
  await db.emailVerificationToken.create({ data: { userId: target.id, tokenHash: "delete-test-token", expiresAt: new Date(Date.now() + 3600000) } });
  assert.equal((await admin.delete(`/api/admin/users/${target.id}`)).status, 204);
  assert.equal(await db.user.findUnique({ where: { id: target.id } }), null);
  assert.equal(await db.session.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.emailVerificationToken.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.gameScore.count({ where: { userId: target.id } }), 0);
  assert.equal((await target.agent.get("/api/auth/me")).status, 401);
});

test("validates input, handles missing users and duplicate profiles without changing data", async () => {
  const target = await register("ValidFrog");
  for (const suffix of ["0", "-1", "abc", "9007199254740993"]) {
    assert.equal((await admin.delete(`/api/admin/users/${suffix}`)).status, 400);
  }
  assert.equal((await admin.delete("/api/admin/users/999999")).status, 404);
  assert.equal((await admin.patch(`/api/admin/users/${target.id}/suspension`).send({ suspended: "false" })).status, 400);
  assert.equal((await admin.patch(`/api/admin/users/${target.id}`).send({ username: "x", email: "bad" })).status, 400);
  assert.equal((await admin.patch(`/api/admin/users/${target.id}`).send({ username: "RegularFrog", email: target.email })).status, 409);
  assert.equal((await db.user.findUnique({ where: { id: target.id } })).username, "ValidFrog");
  for (const query of ["page=0", "page=abc", "page=1.5", "page=1&page=2", "search=a&search=b"]) {
    assert.equal((await admin.get(`/api/admin/users?${query}`)).status, 400, query);
  }
});

test("reports successful edits with a warning when email delivery fails", async () => {
  const target = await register("MailFailure");
  failMail = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await admin.patch(`/api/admin/users/${target.id}`).send({ username: "MailFailure", email: "mail-failed@example.com" });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.email, "mail-failed@example.com");
    assert.match(result.body.warning, /could not be sent/);
  } finally {
    failMail = false;
    console.error = originalError;
  }
  assert.equal((await admin.post(`/api/admin/users/${target.id}/resend-verification`)).status, 200);
});

test("search is case-insensitive, paginated, and returns no password or token data", async () => {
  await db.user.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
    username: `PageFrog${index}`, usernameKey: `pagefrog${index}`, email: `pagefrog${index}@example.com`, passwordHash: "never-public",
  })) });
  const first = await admin.get("/api/admin/users?search=PAGEFROG&page=1");
  assert.equal(first.status, 200);
  assert.equal(first.body.total, 25);
  assert.equal(first.body.pageSize, 20);
  assert.equal(first.body.users.length, 20);
  assert.deepEqual(Object.keys(first.body.users[0]).sort(), ["id", "username", "email", "emailVerified", "isAdmin", "isSuspended", "createdAt", "updatedAt", "canManage"].sort());
  const second = await admin.get("/api/admin/users?search=pagefrog&page=2");
  assert.equal(second.body.users.length, 5);
  assert.equal(new Set([...first.body.users, ...second.body.users].map((user) => user.id)).size, 25);
  const empty = await admin.get("/api/admin/users?search=unknown-account");
  assert.equal(empty.body.total, 0);
  assert.deepEqual(empty.body.users, []);
});
