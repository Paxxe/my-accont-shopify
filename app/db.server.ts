import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

const prisma = globalThis.prismaGlobal ?? new PrismaClient();
globalThis.prismaGlobal = prisma;

export default prisma;
