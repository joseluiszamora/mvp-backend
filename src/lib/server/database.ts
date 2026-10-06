import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { seedDemo, type DemoState, type Preferences } from "@/lib/demo";

const SESSION_SECONDS = 8 * 60 * 60;
export const sessionCookie = "panel_admin_session";
export const sessionMaxAge = SESSION_SECONDS;
export type Database = PrismaClient | Prisma.TransactionClient;
const globalDatabase = globalThis as unknown as { panelPrisma?: PrismaClient; panelInitialization?: Promise<void> };

function client(): PrismaClient {
  if (!globalDatabase.panelPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Configura DATABASE_URL para conectar con PostgreSQL.");
    globalDatabase.panelPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 10_000 }) });
  }
  return globalDatabase.panelPrisma;
}

// El mismo bloqueo protege el estado entre procesos e instancias del servidor.
export async function lockPanel(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(721831)`;
}

async function atomic<T>(db: Database, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if ("$transaction" in db) return db.$transaction(async (tx) => { await lockPanel(tx); return work(tx); }, { maxWait: 10_000, timeout: 30_000 });
  return work(db);
}

export async function getDatabase(): Promise<PrismaClient> {
  const db = client();
  if (!globalDatabase.panelInitialization) {
    globalDatabase.panelInitialization = atomic(db, async (tx) => {
      if (!await tx.panelState.findUnique({ where: { id: 1 } })) await writeState(seedDemo(), tx);
      const password = process.env.PANEL_ADMIN_BOOTSTRAP_PASSWORD;
      const email = process.env.PANEL_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
      if (password && email && await tx.credential.count() === 0) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("PANEL_ADMIN_BOOTSTRAP_EMAIL no es válido.");
        const state = await readState(tx);
        const admin = state.users.find((item) => item.id === "andes-u1");
        if (!admin) throw new Error("Falta la cuenta inicial de administración.");
        admin.email = email;
        await writeState(state, tx);
        await setCredential(admin.id, password, tx);
      }
    }).catch((error: unknown) => { globalDatabase.panelInitialization = undefined; throw error; });
  }
  await globalDatabase.panelInitialization;
  return db;
}

export async function readState(db?: Database): Promise<DemoState> {
  const connection = db ?? await getDatabase();
  return atomic(connection, async (tx) => {
    const meta = await tx.panelState.findUnique({ where: { id: 1 } });
    if (!meta || meta.version !== 2) throw new Error("La base de datos necesita una migración de esquema.");
    const [organizations, users, memberships, roles, files, notifications, audit, preferences] = await Promise.all([
      tx.organization.findMany({ include: { branches: true }, orderBy: { sortOrder: "asc" } }),
      tx.user.findMany({ orderBy: { id: "asc" } }), tx.membership.findMany({ orderBy: { id: "asc" } }),
      tx.role.findMany({ orderBy: { id: "asc" } }), tx.fileRecord.findMany({ orderBy: { createdAt: "desc" } }),
      tx.notification.findMany({ orderBy: { createdAt: "desc" } }), tx.auditEvent.findMany({ orderBy: { createdAt: "desc" } }),
      tx.preference.findMany(),
    ]);
    return {
      version: 2, organizations: organizations.map((organization) => ({ ...organization, branches: organization.branches.map(({ id, name, address, status }) => ({ id, name, address, status })) })),
      users, memberships, roles, files, notifications, audit,
      preferences: Object.fromEntries(preferences.map((p) => [`${p.userId}:${p.organizationId}`, p.payload as unknown as Preferences])),
      accountId: null, organizationId: meta.organizationId, scenario: "normal", latency: 0,
    } as unknown as DemoState;
  });
}

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeState(state: DemoState, db?: Database): Promise<void> {
  const connection = db ?? await getDatabase();
  await atomic(connection, async (tx) => {
    for (const [sortOrder, organization] of state.organizations.entries()) {
      const { branches, ...fields } = organization;
      const data = { ...fields, sortOrder };
      await tx.organization.upsert({ where: { id: data.id }, create: data, update: data });
      for (const branch of branches) {
        const row = { ...branch, organizationId: data.id };
        await tx.branch.upsert({ where: { id: row.id }, create: row, update: row });
      }
    }
    for (const data of state.users) await tx.user.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of state.roles) await tx.role.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of state.memberships) await tx.membership.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of state.files) await tx.fileRecord.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of state.notifications) await tx.notification.upsert({ where: { id: data.id }, create: data, update: data });
    for (const event of state.audit) {
      const data = { ...event, before: json(event.before), after: json(event.after) };
      await tx.auditEvent.upsert({ where: { id: data.id }, create: data, update: data });
    }
    await tx.preference.deleteMany();
    for (const membership of state.memberships) {
      const payload = state.preferences[`${membership.userId}:${membership.organizationId}`];
      if (payload) await tx.preference.create({ data: { userId: membership.userId, organizationId: membership.organizationId, payload: json(payload) } });
    }
    await tx.fileRecord.deleteMany({ where: { id: { notIn: state.files.map((item) => item.id) } } });
    await tx.notification.deleteMany({ where: { id: { notIn: state.notifications.map((item) => item.id) } } });
    await tx.auditEvent.deleteMany({ where: { id: { notIn: state.audit.map((item) => item.id) } } });
    await tx.membership.deleteMany({ where: { id: { notIn: state.memberships.map((item) => item.id) } } });
    await tx.role.deleteMany({ where: { id: { notIn: state.roles.map((item) => item.id) } } });
    await tx.branch.deleteMany({ where: { id: { notIn: state.organizations.flatMap((item) => item.branches.map((branch) => branch.id)) } } });
    await tx.user.deleteMany({ where: { id: { notIn: state.users.map((item) => item.id) } } });
    await tx.organization.deleteMany({ where: { id: { notIn: state.organizations.map((item) => item.id) } } });
    const data = { id: 1, version: state.version, organizationId: state.organizationId };
    await tx.panelState.upsert({ where: { id: 1 }, create: data, update: data });
  });
}

function hashPassword(password: string, salt: string): Buffer { return scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }); }
export async function setCredential(userId: string, password: string, db?: Database): Promise<void> {
  if (password.length < 12 || password.length > 256) throw new Error("La contraseña debe tener entre 12 y 256 caracteres.");
  const salt = randomBytes(32).toString("hex");
  const data = { userId, salt, passwordHash: hashPassword(password, salt).toString("hex"), changedAt: BigInt(Date.now()) };
  await atomic(db ?? await getDatabase(), async (tx) => {
    await tx.credential.upsert({ where: { userId }, create: data, update: data });
    await tx.session.deleteMany({ where: { userId } });
  });
}

export async function verifyCredential(userId: string, password: string, db?: Database): Promise<boolean> {
  const record = await (db ?? await getDatabase()).credential.findUnique({ where: { userId } });
  if (!record) { hashPassword(password, "00".repeat(32)); return false; }
  const actual = hashPassword(password, record.salt);
  const expected = Buffer.from(record.passwordHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function loginBlocked(email: string, db?: Database): Promise<boolean> {
  const record = await (db ?? await getDatabase()).loginAttempt.findUnique({ where: { email } });
  return !!record && record.blockedUntil > BigInt(Date.now());
}
export async function recordLoginFailure(email: string, db?: Database): Promise<void> {
  await atomic(db ?? await getDatabase(), async (tx) => {
    const record = await tx.loginAttempt.upsert({ where: { email }, create: { email, failures: 1, blockedUntil: 0 }, update: { failures: { increment: 1 } } });
    if (record.failures >= 5) await tx.loginAttempt.update({ where: { email }, data: { blockedUntil: BigInt(Date.now() + 15 * 60_000) } });
  });
}
export async function clearLoginFailures(email: string, db?: Database): Promise<void> { await (db ?? await getDatabase()).loginAttempt.deleteMany({ where: { email } }); }

function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export async function createSession(userId: string, organizationId: string, db?: Database): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = BigInt(Date.now());
  await (db ?? await getDatabase()).session.create({ data: { tokenHash: hashToken(token), userId, organizationId, expiresAt: now + BigInt(SESSION_SECONDS * 1000), createdAt: now } });
  return token;
}
export async function findSession(token: string | undefined, db?: Database): Promise<{ userId: string; organizationId: string } | null> {
  if (!token || token.length > 128) return null;
  const row = await (db ?? await getDatabase()).session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.expiresAt <= BigInt(Date.now())) return null;
  return { userId: row.userId, organizationId: row.organizationId };
}
export async function setSessionOrganization(token: string, organizationId: string, db?: Database): Promise<void> {
  await (db ?? await getDatabase()).session.updateMany({ where: { tokenHash: hashToken(token), expiresAt: { gt: BigInt(Date.now()) } }, data: { organizationId } });
}
export async function revokeSession(token: string | undefined, db?: Database): Promise<void> { if (token) await (db ?? await getDatabase()).session.deleteMany({ where: { tokenHash: hashToken(token) } }); }
