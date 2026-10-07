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
import type { FileRecord } from "@/lib/demo";
import { emailConfigured, prepareNotifications, queueEmails } from "@/lib/server/notification-delivery";

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
  const channels = changes.notificationChannels;
  if (channels && typeof channels === "object" && !Array.isArray(channels) && (channels as { correo?: unknown }).correo === true && !emailConfigured()) {
    throw new DemoError("VALIDATION", "El envío por correo no está configurado.");
  }
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
    const newEvents = state.audit.filter((event) => !previous.audit.some((old) => old.id === event.id));
    const emails = prepareNotifications(state, newEvents);
    await writeState(state, tx, previous);
    await queueEmails(tx, emails);
    return { result, state: scopedState(state, session) };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function uploadFile(session: ServerSession, input: { name: string; mimeType: string; bytes: Uint8Array; checksum: string }): Promise<{ record: FileRecord; state: DemoState }> {
  if (!session.permissions.includes("files.manage") || !session.enabledModules.includes("files")) throw new DemoError("DENIED", "No tienes permiso para subir archivos.");
  const db = await getDatabase();
  return db.$transaction(async (tx) => {
    await lockPanel(tx);
    const previous = await readState(tx);
    if (memberFor(previous, session.userId, session.organizationId)?.status !== "Activo") throw new DemoError("DENIED", "Sesión no autorizada.");
    const [usage] = await tx.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(sum(octet_length(b.content)), 0)::bigint AS total FROM file_blobs b
      JOIN files f ON f.id = b.file_id WHERE f."organizationId" = ${session.organizationId}
    `;
    if ((usage?.total ?? 0n) + BigInt(input.bytes.length) > 100n * 1024n * 1024n) throw new DemoError("VALIDATION", "La empresa alcanzó el límite de 100 MB de archivos.");
    let state = structuredClone(previous);
    state.accountId = session.userId;
    state.organizationId = session.organizationId;
    const service = createMockService(() => state, (change) => { const next = structuredClone(state); change(next); state = next; });
    const record = await service.addFile(session.organizationId, { name: input.name, mimeType: input.mimeType, size: input.bytes.length });
    const newEvents = state.audit.filter((event) => !previous.audit.some((old) => old.id === event.id));
    const emails = prepareNotifications(state, newEvents);
    await writeState(state, tx, previous);
    await tx.fileBlob.create({ data: { fileId: record.id, content: input.bytes, checksum: input.checksum } });
    await queueEmails(tx, emails);
    return { record, state: scopedState(state, session) };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export function validOrigin(request: Request): boolean {
  return isAllowedOrigin(request, process.env.PANEL_ADMIN_ORIGIN);
}
