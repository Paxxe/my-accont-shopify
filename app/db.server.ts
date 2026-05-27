import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

function buildPrisma() {
  const base = process.env.DATABASE_URL ?? "";
  const url = base.includes("pgbouncer=true")
    ? base
    : base + (base.includes("?") ? "&" : "?") + "pgbouncer=true";
  const client = new PrismaClient({ datasources: { db: { url } } });
  client.$connect().catch(() => {});
  return client;
}

let prisma: PrismaClient;
if (globalThis.prismaGlobal) {
  prisma = globalThis.prismaGlobal;
} else {
  prisma = buildPrisma();
  globalThis.prismaGlobal = prisma;
}

export default prisma;
