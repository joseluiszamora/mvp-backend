import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedDemo, type DemoState } from "@/lib/demo";

const SESSION_SECONDS = 8 * 60 * 60;
const SESSION_COOKIE = "panel_admin_session";
const dbFile = resolve(process.cwd(), process.env.PANEL_ADMIN_DB_PATH ?? "data/panel-admin.sqlite");
let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;
  mkdirSync(dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS credentials (user_id TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, changed_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, failures INTEGER NOT NULL, blocked_until INTEGER NOT NULL);`);
  if (!db.prepare("SELECT id FROM app_state WHERE id = 1").get()) {
    const state = seedDemo();
    state.accountId = null;
    state.scenario = "normal";
    state.latency = 0;
    db.prepare("INSERT INTO app_state(id, version, payload) VALUES (1, ?, ?)").run(state.version, JSON.stringify(state));
  }
  database = db;
  const initialPassword = process.env.PANEL_ADMIN_BOOTSTRAP_PASSWORD;
  const initialEmail = process.env.PANEL_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (initialPassword && initialEmail && !(db.prepare("SELECT user_id FROM credentials LIMIT 1").get())) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(initialEmail)) throw new Error("PANEL_ADMIN_BOOTSTRAP_EMAIL no es válido.");
    const state = readState(db);
    const admin = state.users.find((item) => item.id === "andes-u1");
    if (!admin) throw new Error("Falta la cuenta inicial de administración.");
    admin.email = initialEmail;
    writeState(state, db);
    setCredential(admin.id, initialPassword, db);
  }
  return db;
}

export function readState(db = getDatabase()): DemoState {
  const row = db.prepare("SELECT version, payload FROM app_state WHERE id = 1").get() as { version: number; payload: string } | undefined;
  if (!row || row.version !== 2) throw new Error("La base de datos necesita una migración de esquema.");
  return JSON.parse(row.payload) as DemoState;
}

export function writeState(state: DemoState, db = getDatabase()): void {
  db.prepare("UPDATE app_state SET version = ?, payload = ? WHERE id = 1").run(state.version, JSON.stringify({ ...state, accountId: null, scenario: "normal", latency: 0 }));
}

function hashPassword(password: string, salt: string): Buffer { return scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }); }
export function setCredential(userId: string, password: string, db = getDatabase()): void {
  if (password.length < 12 || password.length > 256) throw new Error("La contraseña debe tener entre 12 y 256 caracteres.");
  const salt = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO credentials(user_id, salt, password_hash, changed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET salt = excluded.salt, password_hash = excluded.password_hash, changed_at = excluded.changed_at")
    .run(userId, salt, hashPassword(password, salt).toString("hex"), Date.now());
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function verifyCredential(userId: string, password: string, db = getDatabase()): boolean {
  const record = db.prepare("SELECT salt, password_hash FROM credentials WHERE user_id = ?").get(userId) as { salt: string; password_hash: string } | undefined;
  if (!record) { hashPassword(password, "00".repeat(32)); return false; }
  const actual = hashPassword(password, record.salt);
  const expected = Buffer.from(record.password_hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function loginBlocked(email: string, db = getDatabase()): boolean {
  const record = db.prepare("SELECT blocked_until FROM login_attempts WHERE email = ?").get(email) as { blocked_until: number } | undefined;
  return !!record && record.blocked_until > Date.now();
}
export function recordLoginFailure(email: string, db = getDatabase()): void {
  const record = db.prepare("SELECT failures, blocked_until FROM login_attempts WHERE email = ?").get(email) as { failures: number; blocked_until: number } | undefined;
  const failures = record && record.blocked_until > Date.now() ? record.failures + 1 : (record?.failures ?? 0) + 1;
  db.prepare("INSERT INTO login_attempts(email, failures, blocked_until) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET failures = excluded.failures, blocked_until = excluded.blocked_until")
    .run(email, failures, failures >= 5 ? Date.now() + 15 * 60_000 : 0);
}
export function clearLoginFailures(email: string, db = getDatabase()): void { db.prepare("DELETE FROM login_attempts WHERE email = ?").run(email); }

function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function createSession(userId: string, organizationId: string, db = getDatabase()): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions(token_hash, user_id, organization_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(hashToken(token), userId, organizationId, now + SESSION_SECONDS * 1000, now);
  return token;
}
export function findSession(token: string | undefined, db = getDatabase()): { userId: string; organizationId: string } | null {
  if (!token || token.length > 128) return null;
  const row = db.prepare("SELECT user_id, organization_id, expires_at FROM sessions WHERE token_hash = ?").get(hashToken(token)) as { user_id: string; organization_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at <= Date.now()) return null;
  return { userId: row.user_id, organizationId: row.organization_id };
}
export function setSessionOrganization(token: string, organizationId: string, db = getDatabase()): void {
  db.prepare("UPDATE sessions SET organization_id = ? WHERE token_hash = ?").run(organizationId, hashToken(token));
}
export function revokeSession(token: string | undefined, db = getDatabase()): void { if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token)); }
export const sessionCookie = SESSION_COOKIE;
export const sessionMaxAge = SESSION_SECONDS;
