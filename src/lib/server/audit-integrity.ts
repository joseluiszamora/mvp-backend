import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditEvent } from "@/lib/demo";
import type { Database } from "@/lib/server/database";

const ZERO = "0".repeat(64);

function secret(): Buffer {
  const value = process.env.PANEL_AUDIT_HMAC_KEY ?? "";
  if (!/^[a-fA-F0-9]{64,}$/.test(value) || value.length % 2) throw new Error("Configura PANEL_AUDIT_HMAC_KEY con al menos 32 bytes hexadecimales.");
  return Buffer.from(value, "hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function payloadHash(event: Pick<AuditEvent, "id" | "organizationId" | "actorId" | "module" | "action" | "entityId" | "before" | "after" | "createdAt">): string {
  return createHash("sha256").update(canonical({ id: event.id, organizationId: event.organizationId, actorId: event.actorId,
    module: event.module, action: event.action, entityId: event.entityId, before: event.before, after: event.after, createdAt: event.createdAt })).digest("hex");
}

function chainHash(previous: string, payload: string, eventId: string): string {
  return createHmac("sha256", secret()).update(`${previous}:${payload}:${eventId}`).digest("hex");
}

export async function sealEvents(tx: Prisma.TransactionClient, events: AuditEvent[]): Promise<void> {
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const heads = new Map<string, { sequence: bigint; hash: string }>();
  for (const event of ordered) {
    if (await tx.auditSeal.findUnique({ where: { eventId: event.id }, select: { eventId: true } })) continue;
    let head = heads.get(event.organizationId);
    if (!head) {
      const latest = await tx.auditSeal.findFirst({ where: { organizationId: event.organizationId }, orderBy: { sequence: "desc" }, select: { sequence: true, chainHash: true } });
      head = { sequence: latest?.sequence ?? 0n, hash: latest?.chainHash ?? ZERO };
    }
    const hash = payloadHash(event);
    const chained = chainHash(head.hash, hash, event.id);
    await tx.auditSeal.create({ data: { eventId: event.id, organizationId: event.organizationId, sequence: head.sequence + 1n,
      previousHash: head.hash, payloadHash: hash, chainHash: chained, eventCreatedAt: event.createdAt, sealedAt: BigInt(Date.now()) } });
    heads.set(event.organizationId, { sequence: head.sequence + 1n, hash: chained });
  }
}

export function retentionDays(): number {
  const days = Number(process.env.PANEL_AUDIT_RETENTION_DAYS ?? 365);
  if (!Number.isSafeInteger(days) || days < 30 || days > 3650) throw new Error("PANEL_AUDIT_RETENTION_DAYS debe estar entre 30 y 3650.");
  return days;
}

export async function maintainAudit(tx: Prisma.TransactionClient): Promise<number> {
  secret();
  const missing = await tx.$queryRaw<AuditEvent[]>`
    SELECT e.* FROM audit_events e LEFT JOIN audit_seals s ON s.event_id = e.id
    WHERE s.event_id IS NULL ORDER BY e."createdAt", e.id
  `;
  if (missing.length) {
    const existing = await tx.auditSeal.count();
    if (existing) throw new Error("Hay eventos de auditoría sin sello; revisa la integridad antes de continuar.");
    await sealEvents(tx, missing);
  }
  const organizations = await tx.organization.findMany({ select: { id: true } });
  for (const organization of organizations) {
    const result = await verifyAudit(tx, organization.id);
    if (!result.valid) throw new Error(`Auditoría alterada en ${organization.id}: ${result.issue}`);
  }
  const cutoff = new Date(Date.now() - retentionDays() * 86_400_000).toISOString();
  const removed = await tx.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return removed.count;
}

export async function verifyAudit(db: Database, organizationId: string): Promise<{ valid: boolean; events: number; retained: number; issue?: string }> {
  const seals = await db.auditSeal.findMany({ where: { organizationId }, orderBy: { sequence: "asc" } });
  const events = await db.auditEvent.findMany({ where: { organizationId } });
  const byId = new Map(events.map((event) => [event.id, event]));
  const sealedIds = new Set(seals.map((seal) => seal.eventId));
  const cutoff = new Date(Date.now() - retentionDays() * 86_400_000).toISOString();
  let previous = ZERO;
  let sequence = 0n;
  for (const seal of seals) {
    const actual = byId.get(seal.eventId);
    const expectedChain = chainHash(previous, seal.payloadHash, seal.eventId);
    const stored = Buffer.from(seal.chainHash, "hex");
    const expected = Buffer.from(expectedChain, "hex");
    if (seal.sequence !== ++sequence || seal.previousHash !== previous || stored.length !== expected.length || !timingSafeEqual(stored, expected)) {
      return { valid: false, events: seals.length, retained: events.length, issue: "La cadena de sellos está alterada." };
    }
    if (actual && payloadHash(actual) !== seal.payloadHash) return { valid: false, events: seals.length, retained: events.length, issue: "Un evento fue modificado." };
    if (!actual && seal.eventCreatedAt >= cutoff) return { valid: false, events: seals.length, retained: events.length, issue: "Falta un evento dentro del período de retención." };
    previous = seal.chainHash;
  }
  if (events.some((event) => !sealedIds.has(event.id))) return { valid: false, events: seals.length, retained: events.length, issue: "Hay eventos sin sello." };
  return { valid: true, events: seals.length, retained: events.length };
}
