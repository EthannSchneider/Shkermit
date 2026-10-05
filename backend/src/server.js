import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createDatabase } from "./database/index.js";
import { createSessionModel } from "./models/session.model.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.resolve(sourceDirectory, "../data/shkermit.db");
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const sessionTtlDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? "30", 10);
const sessionTtlMs = sessionTtlDays * 24 * 60 * 60 * 1000;
const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultDatabasePath}`;

const db = createDatabase(databaseUrl);
await createSessionModel(db).deleteExpired(new Date());

const app = createApp({
  db,
  sessionTtlMs,
  isProduction: process.env.NODE_ENV === "production",
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
