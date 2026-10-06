import "server-only";

import { cookies } from "next/headers";
import { DemoError, memberFor, type DemoState } from "@/lib/demo";
import { createMockService, type MockService } from "@/lib/demo-service";
import { scopedState } from "@/lib/scope";
import { findSession, getDatabase, lockPanel, readState, sessionCookie, writeState } from "@/lib/server/database";

export type ServerSession = { userId: string; organizationId: string };
export async function currentSession(): Promise<ServerSession | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  const session = await findSession(token);
  if (!session) return null;
  const state = await readState();
  return memberFor(state, session.userId, session.organizationId)?.status === "Activo" ? session : null;
}

export { scopedState } from "@/lib/scope";

export async function snapshot(session: ServerSession): Promise<DemoState> {
  return scopedState(await readState(), session);
}

function string(value: unknown): string { if (typeof value !== "string") throw new DemoError("VALIDATION", "Solicitud inválida."); return value; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new DemoError("VALIDATION", "Solicitud inválida."); return value as Record<string, unknown>; }
function strings(value: unknown): string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new DemoError("VALIDATION", "Solicitud inválida."); return value; }
function org(session: ServerSession, value: unknown): string { const id = string(value); if (id !== session.organizationId) throw new DemoError("DENIED", "Empresa no autorizada."); return id; }

async function dispatch(service: MockService, session: ServerSession, method: string, args: unknown[]): Promise<unknown> {
  const a = args;
  switch (method) {
    case "listUsers": return service.listUsers({ ...object(a[0]), organizationId: org(session, object(a[0]).organizationId) } as Parameters<MockService["listUsers"]>[0]);
    case "saveUser": return service.saveUser({ ...object(a[0]), organizationId: org(session, object(a[0]).organizationId) } as Parameters<MockService["saveUser"]>[0]);
    case "changeUserStatus": return service.changeUserStatus(org(session, a[0]), strings(a[1]));
    case "listRoles": return service.listRoles(org(session, a[0]));
    case "createRole": return service.createRole(org(session, a[0]), string(a[1]));
    case "setRolePermission": return service.setRolePermission(org(session, a[0]), string(a[1]), string(a[2]) as Parameters<MockService["setRolePermission"]>[2], Boolean(a[3]));
    case "listFiles": return service.listFiles(org(session, a[0]), object(a[1] ?? {}) as Parameters<MockService["listFiles"]>[1]);
    case "addFile": return service.addFile(org(session, a[0]), object(a[1]) as Parameters<MockService["addFile"]>[1]);
    case "renameFile": return service.renameFile(org(session, a[0]), string(a[1]), string(a[2]));
    case "deleteFile": return service.deleteFile(org(session, a[0]), string(a[1]));
    case "listNotifications": return service.listNotifications(org(session, a[0]));
    case "markNotifications": return service.markNotifications(org(session, a[0]), strings(a[1]));
    case "listAudit": return service.listAudit(org(session, a[0]), object(a[1] ?? {}) as Parameters<MockService["listAudit"]>[1]);
    case "updateOrganization": return service.updateOrganization(org(session, a[0]), object(a[1]) as Parameters<MockService["updateOrganization"]>[1]);
    case "addBranch": return service.addBranch(org(session, a[0]), string(a[1]));
    case "updateBranch": return service.updateBranch(org(session, a[0]), string(a[1]), object(a[2]) as Parameters<MockService["updateBranch"]>[2]);
    case "updatePreferences": return service.updatePreferences(org(session, a[0]), object(a[1]) as Parameters<MockService["updatePreferences"]>[1]);
    case "updateProfile": return service.updateProfile(object(a[0]) as Parameters<MockService["updateProfile"]>[0]);
    default: throw new DemoError("NOT_FOUND", "Operación desconocida.");
  }
}

const reads = new Set(["listUsers", "listRoles", "listFiles", "listNotifications", "listAudit"]);
export async function runOperation(session: ServerSession, method: string, args: unknown[]): Promise<{ result: unknown; state: DemoState }> {
  const db = await getDatabase();
  return db.$transaction(async (tx) => {
    await lockPanel(tx);
    let state = await readState(tx);
    if (memberFor(state, session.userId, session.organizationId)?.status !== "Activo") throw new DemoError("DENIED", "Sesión no autorizada.");
    state.accountId = session.userId;
    state.organizationId = session.organizationId;
    state.scenario = "normal";
    state.latency = 0;
    const service = createMockService(() => state, (change) => { const next = structuredClone(state); change(next); state = next; });
    const result = await dispatch(service, session, method, args);
    if (!reads.has(method)) await writeState(state, tx);
    return { result, state: scopedState(state, session) };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const allowed = process.env.PANEL_ADMIN_ORIGIN ?? new URL(request.url).origin;
  return origin === allowed;
}
