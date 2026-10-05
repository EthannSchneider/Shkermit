import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDatabase } from "./database/index.js";
import { createSessionModel } from "./models/session.model.js";
import { createEmailVerificationModel } from "./models/email-verification.model.js";
import { createMailer } from "./services/mailer.service.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.resolve(sourceDirectory, "../data/shkermit.db");
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
await createSessionModel(db).deleteExpired(new Date());
await createEmailVerificationModel(db).deleteExpired(new Date());

const app = createApp({
  db,
  sessionTtlMs,
  emailVerificationTtlMs,
  appUrl,
  mailer,
  isProduction,
});

const server = app.listen(port, () => {
  console.log(`Shkermit API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
