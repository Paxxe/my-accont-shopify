import prisma from "../db.server";

export async function loader() {
  const dbUrl = process.env.DATABASE_URL ?? "NOT SET";
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ":***@");

  const results: Record<string, any> = { db: safeUrl };

  try {
    await prisma.$queryRaw`SELECT 1`;
    results.ping = "ok";
  } catch (e: any) {
    results.ping = e.message;
  }

  try {
    const count = await prisma.session.count();
    results.sessionTable = `ok (${count} rows)`;
  } catch (e: any) {
    results.sessionTable = e.message;
  }

  try {
    const count = await prisma.appSettings.count();
    results.appSettingsTable = `ok (${count} rows)`;
  } catch (e: any) {
    results.appSettingsTable = e.message;
  }

  return Response.json(results);
}
