import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { seedDemo, type Organization } from "../src/lib/demo";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const email = process.env.PANEL_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.PANEL_ADMIN_BOOTSTRAP_PASSWORD ?? "";

if (!databaseUrl) throw new Error("Configura DIRECT_URL o DATABASE_URL en .env.");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Configura PANEL_ADMIN_BOOTSTRAP_EMAIL válido en .env.");
if (!password || password.length < 12 || password.length > 256) throw new Error("Configura PANEL_ADMIN_BOOTSTRAP_PASSWORD de 12 a 256 caracteres en .env.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10_000 }) });

function organizationData(organization: Organization, sortOrder: number) {
  return {
    id: organization.id, name: organization.name, sortOrder, slug: organization.slug,
    color: organization.color, currency: organization.currency, timezone: organization.timezone,
    logoLight: organization.logoLight ?? null, logoDark: organization.logoDark ?? null,
    logoCompact: organization.logoCompact ?? null, favicon: organization.favicon ?? null,
    enabledModules: organization.enabledModules,
  };
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(721831)`;
    const initialized = await tx.panelState.findUnique({ where: { id: 1 } });
    if (initialized) {
      console.log("Seed omitido: la base ya está inicializada; no se modificaron datos.");
      return;
    }

    const existing = await Promise.all([
      tx.organization.count(), tx.branch.count(), tx.user.count(), tx.role.count(), tx.membership.count(),
      tx.fileRecord.count(), tx.notification.count(), tx.auditEvent.count(), tx.credential.count(),
    ]);
    if (existing.some((count) => count > 0)) throw new Error("La base tiene datos sin marcador de inicialización; no se aplicó el seed para evitar mezclar registros.");

    const state = seedDemo();
    state.accountId = null;
    state.scenario = "normal";
    state.latency = 0;
    const admin = state.users.find((user) => user.id === "andes-u1");
    if (!admin) throw new Error("Falta el usuario administrador inicial Andes.");
    admin.email = email;

    await tx.organization.createMany({ data: state.organizations.map((organization, sortOrder) => organizationData(organization, sortOrder)) });
    await tx.branch.createMany({ data: state.organizations.flatMap((organization) => organization.branches.map((branch) => ({ ...branch, organizationId: organization.id }))) });
    await tx.user.createMany({ data: state.users });
    await tx.role.createMany({ data: state.roles });
    await tx.membership.createMany({ data: state.memberships });
    await tx.fileRecord.createMany({ data: state.files });
    await tx.notification.createMany({ data: state.notifications });
    await tx.auditEvent.createMany({ data: state.audit.map((event) => ({ ...event, before: Prisma.JsonNull, after: Prisma.JsonNull })) });

    const salt = randomBytes(32).toString("hex");
    const passwordHash = scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    await tx.credential.create({ data: { userId: admin.id, salt, passwordHash, changedAt: BigInt(Date.now()) } });
    await tx.panelState.create({ data: { id: 1, version: state.version, organizationId: state.organizationId } });
  }, { maxWait: 10_000, timeout: 30_000 });

  const [organizations, users, memberships, roles, branches, files, notifications, audit, credentials] = await Promise.all([
    prisma.organization.count(), prisma.user.count(), prisma.membership.count(), prisma.role.count(), prisma.branch.count(),
    prisma.fileRecord.count(), prisma.notification.count(), prisma.auditEvent.count(), prisma.credential.count(),
  ]);
  console.log(JSON.stringify({ seed: "aplicado", organizations, users, memberships, roles, branches, files, notifications, auditEvents: audit, credentials }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falló el seed de base de datos.");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
