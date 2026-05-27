import prisma from "../db.server";

export async function loader() {
  const dbUrl = process.env.DATABASE_URL ?? "NOT SET";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":***@");

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: safeUrl, connected: true });
  } catch (e: any) {
    return Response.json({ ok: false, db: safeUrl, connected: false, error: e.message });
  }
}
