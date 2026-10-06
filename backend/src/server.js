import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { SESSION_COOKIE_NAME } from "./config/security.js";
import { createDatabase } from "./database/index.js";
import { createSessionModel } from "./models/session.model.js";
import { createEmailVerificationModel } from "./models/email-verification.model.js";
import { createUserModel } from "./models/user.model.js";
import { createGameScoreModel } from "./models/game-score.model.js";
import { createMailer } from "./services/mailer.service.js";
import { createGameScoreService } from "./services/game-score.service.js";
import { createSessionService } from "./services/session.service.js";
import { createTetrisWebSocketServer } from "./websocket/tetris-websocket.js";

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (typeof header !== "string") return null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    const value = entry.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.resolve(sourceDirectory, "../data/shkermit.db");
const publicDirectory = path.resolve(sourceDirectory, "../public");
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const sessionTtlDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? "30", 10);
const sessionTtlMs = sessionTtlDays * 24 * 60 * 60 * 1000;
const emailVerificationTtlHours = Number.parseInt(
  process.env.EMAIL_VERIFICATION_TTL_HOURS ?? "24",
  10,
);
const emailVerificationTtlMs = emailVerificationTtlHours * 60 * 60 * 1000;
const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultDatabasePath}`;
const isProduction = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const pictureUploadDirectory = path.resolve(
  process.env.PICTURE_UPLOAD_DIR ?? path.resolve(sourceDirectory, "../data/files/pictures"),
);
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
const mailer = createMailer({
  isProduction,
  from: process.env.SMTP_FROM ?? "Shkermit <no-reply@localhost>",
  smtp: {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },
});

const db = createDatabase(databaseUrl);
const sessionModel = createSessionModel(db);
const userModel = createUserModel(db, { adminEmails });
const sessionService = createSessionService({ sessionModel, sessionTtlMs });
const gameScoreService = createGameScoreService({ gameScoreModel: createGameScoreModel(db) });
await sessionModel.deleteExpired(new Date());
await createEmailVerificationModel(db).deleteExpired(new Date());

const app = createApp({
  db,
  sessionTtlMs,
  emailVerificationTtlMs,
  appUrl,
  mailer,
  adminEmails,
  pictureUploadDirectory,
  frontendDirectory: existsSync(path.join(publicDirectory, "index.html")) ? publicDirectory : null,
  isProduction,
});

const server = app.listen(port, () => {
  console.log(`Shkermit API listening on http://localhost:${port}`);
});
const tetrisWebSockets = createTetrisWebSocketServer(server, {
  async resolveUser(request) {
    const token = readCookie(request, SESSION_COOKIE_NAME);
    const session = await sessionService.findValid(token);
    return session ? userModel.findById(session.userId) : null;
  },
  saveScore(userId, mode, score) {
    return gameScoreService.save(userId, "tetris", mode, score, { trusted: true });
  },
});

async function shutdown() {
  tetrisWebSockets.close();
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
