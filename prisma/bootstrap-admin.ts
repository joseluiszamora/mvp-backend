import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const email = process.env.PANEL_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.PANEL_ADMIN_BOOTSTRAP_PASSWORD ?? "";
const userId = "andes-u1";

if (!databaseUrl) throw new Error("Configura DIRECT_URL o DATABASE_URL en .env.");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Configura PANEL_ADMIN_BOOTSTRAP_EMAIL válido en .env.");
if (!password || password.length < 12 || password.length > 256) throw new Error("Configura PANEL_ADMIN_BOOTSTRAP_PASSWORD de 12 a 256 caracteres en .env.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10_000 }) });

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(721831)`;
    const admin = await tx.user.findUnique({ where: { id: userId }, include: { credential: true } });
    if (!admin) throw new Error("No existe la cuenta administradora inicial. Ejecuta primero npm run db:seed.");

    const collision = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = ${email} AND id <> ${userId} LIMIT 1`;
    if (collision.length) throw new Error("Ese correo ya está asignado a otra cuenta.");

    const membership = await tx.membership.findFirst({
      where: { userId, organizationId: "andes", status: "Activo" },
      include: { role: true },
    });
    if (!membership || membership.role.name !== "Administrador") throw new Error("La cuenta inicial ya no conserva el rol administrador de Andes.");

    const salt = randomBytes(32).toString("hex");
    const passwordHash = scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    await tx.user.update({ where: { id: userId }, data: { email } });
    await tx.credential.upsert({
      where: { userId },
      create: { userId, salt, passwordHash, changedAt: BigInt(Date.now()) },
      update: { salt, passwordHash, changedAt: BigInt(Date.now()) },
    });
    await tx.session.deleteMany({ where: { userId } });
  }, { maxWait: 10_000, timeout: 30_000 });

  console.log("Cuenta administradora actualizada desde .env; las sesiones anteriores fueron revocadas.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo actualizar la cuenta administradora.");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
