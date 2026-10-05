import { PrismaClient } from "@prisma/client";

export function createDatabase(databaseUrl) {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
