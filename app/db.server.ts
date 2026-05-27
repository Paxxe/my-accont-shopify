import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

let prisma: PrismaClient;
if (globalThis.prismaGlobal) {
  prisma = globalThis.prismaGlobal;
} else {
  prisma = new PrismaClient();
  prisma.$connect().catch(() => {});
  globalThis.prismaGlobal = prisma;
}

export default prisma;
