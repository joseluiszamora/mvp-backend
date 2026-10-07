import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { DemoError, seedDemo, type DemoState, type Permission } from "@/lib/demo";
import { maintainAudit, sealEvents } from "@/lib/server/audit-integrity";

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
    globalDatabase.panelInitialization = (async () => {
      const password = process.env.PANEL_ADMIN_BOOTSTRAP_PASSWORD;
      const email = process.env.PANEL_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
      const [initialized] = await db.$queryRaw<{ version: number | null; credentials: boolean }[]>`
        SELECT (SELECT version FROM panel_state WHERE id = 1) AS version, EXISTS(SELECT 1 FROM credentials) AS credentials
      `;
      if (initialized?.version !== 2 || (password && email && !initialized?.credentials)) {
        await atomic(db, async (tx) => {
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
        });
      }
      await atomic(db, maintainAudit);
    })().catch((error: unknown) => { globalDatabase.panelInitialization = undefined; throw error; });
  }
  await globalDatabase.panelInitialization;
  return db;
}

// Cada SELECT ve una instantánea MVCC coherente; agregar JSON en PostgreSQL evita
// los viajes en serie de una transacción interactiva por cada tabla.
export async function readState(db?: Database, session?: { userId: string; organizationId: string }): Promise<DemoState> {
  const connection = db ?? await getDatabase();
  const access = session ? Prisma.sql`
    SELECT m."userId" AS user_id, m."organizationId" AS organization_id, false AS all_data,
      'users.read' = ANY(r.permissions) AS users_read,
      'files.read' = ANY(r.permissions) AS files_read,
      'audit.read' = ANY(r.permissions) AS audit_read
    FROM memberships m JOIN roles r ON r.id = m."roleId" AND r."organizationId" = m."organizationId"
    WHERE m."userId" = ${session.userId} AND m."organizationId" = ${session.organizationId} AND m.status = 'Activo'
  ` : Prisma.sql`SELECT NULL::text AS user_id, NULL::text AS organization_id,
    true AS all_data, true AS users_read, true AS files_read, true AS audit_read`;
  const rows = await connection.$queryRaw<{ state: DemoState }[]>(Prisma.sql`
    WITH access AS (${access})
    SELECT jsonb_build_object(
      'version', meta.version, 'accountId', a.user_id,
      'organizationId', COALESCE(a.organization_id, meta.organization_id), 'scenario', 'normal', 'latency', 0,
      'organizations', COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object('branches',
        COALESCE((SELECT jsonb_agg(to_jsonb(b) - 'organizationId' ORDER BY b.id) FROM branches b WHERE b."organizationId" = o.id), '[]'::jsonb)) ORDER BY o."sortOrder")
        FROM organizations o WHERE a.all_data OR EXISTS (SELECT 1 FROM memberships m WHERE m."organizationId" = o.id AND m."userId" = a.user_id AND m.status = 'Activo')), '[]'::jsonb),
      'users', COALESCE((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.id) FROM users u
        WHERE a.all_data OR u.id = a.user_id OR a.users_read AND EXISTS (SELECT 1 FROM memberships m WHERE m."userId" = u.id AND m."organizationId" = a.organization_id)), '[]'::jsonb),
      'memberships', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM memberships m
        WHERE a.all_data OR m."userId" = a.user_id OR a.users_read AND m."organizationId" = a.organization_id), '[]'::jsonb),
      'roles', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM roles r WHERE a.all_data OR r."organizationId" = a.organization_id), '[]'::jsonb),
      'files', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."createdAt" DESC, f.id) FROM files f
        WHERE a.all_data OR a.files_read AND f."organizationId" = a.organization_id), '[]'::jsonb),
      'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n."createdAt" DESC, n.id) FROM notifications n
        WHERE a.all_data OR n."organizationId" = a.organization_id AND n."userId" = a.user_id), '[]'::jsonb),
      'audit', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e."createdAt" DESC, e.id) FROM
        (SELECT e.* FROM audit_events e WHERE a.all_data OR a.audit_read AND e."organizationId" = a.organization_id
          ORDER BY e."createdAt" DESC, e.id LIMIT CASE WHEN a.all_data THEN NULL ELSE 500 END) e), '[]'::jsonb),
      'preferences', COALESCE((SELECT jsonb_object_agg(p."userId" || ':' || p."organizationId", p.payload) FROM preferences p
        WHERE a.all_data OR p."userId" = a.user_id AND p."organizationId" = a.organization_id), '{}'::jsonb)
    ) AS state FROM panel_state meta CROSS JOIN access a WHERE meta.id = 1
  `);
  const state = rows[0]?.state;
  if (!state && session) throw new DemoError("DENIED", "Sesión no autorizada.");
  if (!state || state.version !== 2) throw new Error("La base de datos necesita una migración de esquema.");
  return state;
}

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeState(state: DemoState, db?: Database, previous?: DemoState): Promise<void> {
  const connection = db ?? await getDatabase();
  await atomic(connection, async (tx) => {
    const changed = <T extends { id: string }>(rows: T[], before?: T[]): T[] => {
      if (!before) return rows;
      const old = new Map(before.map((row) => [row.id, JSON.stringify(row)]));
      return rows.filter((row) => old.get(row.id) !== JSON.stringify(row));
    };
    for (const [sortOrder, organization] of state.organizations.entries()) {
      const { branches, ...fields } = organization;
      const data = { ...fields, sortOrder };
      if (!previous || JSON.stringify(previous.organizations[sortOrder]) !== JSON.stringify(organization)) await tx.organization.upsert({ where: { id: data.id }, create: data, update: data });
      for (const branch of changed(branches, previous?.organizations.find((item) => item.id === data.id)?.branches)) {
        const row = { ...branch, organizationId: data.id };
        await tx.branch.upsert({ where: { id: row.id }, create: row, update: row });
      }
    }
    for (const data of changed(state.users, previous?.users)) await tx.user.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of changed(state.roles, previous?.roles)) await tx.role.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of changed(state.memberships, previous?.memberships)) await tx.membership.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of changed(state.files, previous?.files)) await tx.fileRecord.upsert({ where: { id: data.id }, create: data, update: data });
    for (const data of changed(state.notifications, previous?.notifications)) await tx.notification.upsert({ where: { id: data.id }, create: data, update: data });
    const newEvents = state.audit.filter((event) => !previous?.audit.some((old) => old.id === event.id));
    if (previous?.audit.some((old) => state.audit.some((event) => event.id === old.id && JSON.stringify(event) !== JSON.stringify(old)))) throw new Error("Los eventos de auditoría no se pueden modificar.");
    for (const event of newEvents) {
      const data = { ...event, before: json(event.before), after: json(event.after) };
      await tx.auditEvent.create({ data });
    }
    await sealEvents(tx, newEvents);
    for (const membership of state.memberships) {
      const payload = state.preferences[`${membership.userId}:${membership.organizationId}`];
      if (JSON.stringify(payload) === JSON.stringify(previous?.preferences[`${membership.userId}:${membership.organizationId}`]) && previous) continue;
      const where = { userId_organizationId: { userId: membership.userId, organizationId: membership.organizationId } };
      if (payload) {
        const data = { userId: membership.userId, organizationId: membership.organizationId, payload: json(payload) };
        await tx.preference.upsert({ where, create: data, update: { payload: data.payload } });
      } else await tx.preference.deleteMany({ where: where.userId_organizationId });
    }
    if (!previous || previous.files.some((old) => !state.files.some((row) => row.id === old.id))) await tx.fileRecord.deleteMany({ where: { id: { notIn: state.files.map((item) => item.id) } } });
    if (!previous || previous.notifications.some((old) => !state.notifications.some((row) => row.id === old.id))) await tx.notification.deleteMany({ where: { id: { notIn: state.notifications.map((item) => item.id) } } });
    if (!previous || previous.memberships.some((old) => !state.memberships.some((row) => row.id === old.id))) await tx.membership.deleteMany({ where: { id: { notIn: state.memberships.map((item) => item.id) } } });
    if (!previous || previous.roles.some((old) => !state.roles.some((row) => row.id === old.id))) await tx.role.deleteMany({ where: { id: { notIn: state.roles.map((item) => item.id) } } });
    if (!previous || previous.organizations.flatMap((org) => org.branches).some((old) => !state.organizations.some((org) => org.branches.some((row) => row.id === old.id)))) await tx.branch.deleteMany({ where: { id: { notIn: state.organizations.flatMap((item) => item.branches.map((branch) => branch.id)) } } });
    if (!previous || previous.users.some((old) => !state.users.some((row) => row.id === old.id))) await tx.user.deleteMany({ where: { id: { notIn: state.users.map((item) => item.id) } } });
    if (!previous || previous.organizations.some((old) => !state.organizations.some((row) => row.id === old.id))) await tx.organization.deleteMany({ where: { id: { notIn: state.organizations.map((item) => item.id) } } });
    const data = { id: 1, version: state.version, organizationId: state.organizationId };
    if (!previous || previous.version !== state.version || previous.organizationId !== state.organizationId) await tx.panelState.upsert({ where: { id: 1 }, create: data, update: data });
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
    const existing = await tx.loginAttempt.findUnique({ where: { email } });
    const expired = existing && existing.blockedUntil > 0 && existing.blockedUntil <= BigInt(Date.now());
    const record = await tx.loginAttempt.upsert({ where: { email }, create: { email, failures: 1, blockedUntil: 0 }, update: expired ? { failures: 1, blockedUntil: 0 } : { failures: { increment: 1 } } });
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
export type AuthorizedSession = { userId: string; organizationId: string; permissions: Permission[]; enabledModules: string[] };
export async function findSession(token: string | undefined, db?: Database): Promise<AuthorizedSession | null> {
  if (!token || token.length > 128) return null;
  const connection = db ?? await getDatabase();
  const rows = await connection.$queryRaw<AuthorizedSession[]>`
    SELECT s.user_id AS "userId", s.organization_id AS "organizationId", r.permissions, o."enabledModules"
    FROM sessions s JOIN memberships m ON m."userId" = s.user_id AND m."organizationId" = s.organization_id
    JOIN roles r ON r.id = m."roleId" AND r."organizationId" = m."organizationId"
    JOIN organizations o ON o.id = m."organizationId"
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > ${BigInt(Date.now())} AND m.status = 'Activo'
  `;
  return rows[0] ?? null;
}

export async function setSessionOrganization(token: string, organizationId: string, db?: Database): Promise<void> {
  await (db ?? await getDatabase()).session.updateMany({ where: { tokenHash: hashToken(token), expiresAt: { gt: BigInt(Date.now()) } }, data: { organizationId } });
}
export async function revokeSession(token: string | undefined, db?: Database): Promise<void> { if (token) await (db ?? await getDatabase()).session.deleteMany({ where: { tokenHash: hashToken(token) } }); }
