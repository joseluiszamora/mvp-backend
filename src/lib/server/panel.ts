import "server-only";

import { isAllowedOrigin } from "@/lib/request-origin";
import { cache } from "react";
import { writePreferences } from "@/lib/server/preferences";
import { readMethods, runReadOperation } from "@/lib/server/panel-reads";
import { cookies } from "next/headers";
import { DemoError, memberFor, modules, type ModuleId, type AuditEvent, type DemoState } from "@/lib/demo";
import { createMockService, type MockService } from "@/lib/demo-service";
import { scopedState } from "@/lib/scope";
import { findSession, getDatabase, lockPanel, readState, sessionCookie, writeState, type AuthorizedSession } from "@/lib/server/database";

export type ServerSession = AuthorizedSession;
// cache() solo comparte dentro del render/petición, nunca entre usuarios o peticiones.
export const currentSession = cache(async (): Promise<ServerSession | null> => {
  const token = (await cookies()).get(sessionCookie)?.value;
  return findSession(token);
});

export async function canAccessModule(session: ServerSession, module: ModuleId): Promise<boolean> {
  const entry = modules.find((item) => item.id === module);
  return !!entry && session.enabledModules.includes(module)
    && (!entry.permission || session.permissions.includes(entry.permission));
}

export { scopedState } from "@/lib/scope";

export async function snapshot(session: Pick<ServerSession, "userId" | "organizationId">): Promise<DemoState> {
  return readState(undefined, session);
}

function string(value: unknown): string { if (typeof value !== "string") throw new DemoError("VALIDATION", "Solicitud inválida."); return value; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new DemoError("VALIDATION", "Solicitud inválida."); return value as Record<string, unknown>; }
function strings(value: unknown): string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new DemoError("VALIDATION", "Solicitud inválida."); return value; }
function org(session: ServerSession, value: unknown): string { const id = string(value); if (id !== session.organizationId) throw new DemoError("DENIED", "Empresa no autorizada."); return id; }

async function dispatch(service: MockService, session: ServerSession, method: string, args: unknown[]): Promise<unknown> {
  const a = args;
  switch (method) {
    case "saveUser": return service.saveUser({ ...object(a[0]), organizationId: org(session, object(a[0]).organizationId) } as Parameters<MockService["saveUser"]>[0]);
    case "changeUserStatus": return service.changeUserStatus(org(session, a[0]), strings(a[1]));
    case "createRole": return service.createRole(org(session, a[0]), string(a[1]));
    case "setRolePermission": return service.setRolePermission(org(session, a[0]), string(a[1]), string(a[2]) as Parameters<MockService["setRolePermission"]>[2], Boolean(a[3]));
    case "addFile": return service.addFile(org(session, a[0]), object(a[1]) as Parameters<MockService["addFile"]>[1]);
    case "renameFile": return service.renameFile(org(session, a[0]), string(a[1]), string(a[2]));
    case "deleteFile": return service.deleteFile(org(session, a[0]), string(a[1]));
    case "markNotifications": return service.markNotifications(org(session, a[0]), strings(a[1]));
    case "updateOrganization": return service.updateOrganization(org(session, a[0]), object(a[1]) as Parameters<MockService["updateOrganization"]>[1]);
    case "addBranch": return service.addBranch(org(session, a[0]), string(a[1]));
    case "updateBranch": return service.updateBranch(org(session, a[0]), string(a[1]), object(a[2]) as Parameters<MockService["updateBranch"]>[2]);
    case "updateProfile": return service.updateProfile(object(a[0]) as Parameters<MockService["updateProfile"]>[0]);
    default: throw new DemoError("NOT_FOUND", "Operación desconocida.");
  }
}

type OperationResponse = { result: unknown; state?: DemoState; patch?: Partial<DemoState>; auditEvent?: AuditEvent };

async function savePreferences(session: ServerSession, args: unknown[]): Promise<OperationResponse> {
  const organizationId = org(session, args[0]);
  const changes = object(args[1]);
  const db = await getDatabase();
  return db.$transaction(async (tx) => {
    // Conserva la coordinación con las operaciones que aún escriben mediante el contrato de estado.
    await lockPanel(tx);
    const { preference: payload, event } = await writePreferences(tx, session, changes);
    const key = `${session.userId}:${organizationId}`;
    return { result: null, patch: { preferences: { [key]: payload } }, ...(session.permissions.includes("audit.read") ? { auditEvent: event } : {}) };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function runOperation(session: ServerSession, method: string, args: unknown[]): Promise<OperationResponse> {
  const db = await getDatabase();
  if (readMethods.has(method)) return { result: await runReadOperation(db, session, method, args) };
  if (method === "updatePreferences") return savePreferences(session, args);
  return db.$transaction(async (tx) => {
    await lockPanel(tx);
    const previous = await readState(tx);
    if (memberFor(previous, session.userId, session.organizationId)?.status !== "Activo") throw new DemoError("DENIED", "Sesión no autorizada.");
    let state = structuredClone(previous);
    state.accountId = session.userId;
    state.organizationId = session.organizationId;
    const service = createMockService(() => state, (change) => { const next = structuredClone(state); change(next); state = next; });
    const result = await dispatch(service, session, method, args);
    await writeState(state, tx, previous);
    return { result, state: scopedState(state, session) };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export function validOrigin(request: Request): boolean {
  return isAllowedOrigin(request, process.env.PANEL_ADMIN_ORIGIN);
}
