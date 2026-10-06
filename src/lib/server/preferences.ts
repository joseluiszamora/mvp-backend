import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { DemoError, type AuditEvent, type DemoState, type Preferences } from "@/lib/demo";
import { createMockService } from "@/lib/demo-service";

// Se ejecuta dentro de la transacción que posee el bloqueo de escritura del panel.
export async function writePreferences(tx: Prisma.TransactionClient, session: { userId: string; organizationId: string }, changes: Record<string, unknown>): Promise<{ preference: Preferences; event: AuditEvent }> {
  const organizationId = session.organizationId;
  const rows = await tx.$queryRaw<{ membership: DemoState["memberships"][number]; preference: Preferences | null }[]>`
    SELECT to_jsonb(m) AS membership, p.payload AS preference FROM memberships m
    LEFT JOIN preferences p ON p."userId" = m."userId" AND p."organizationId" = m."organizationId"
    WHERE m."userId" = ${session.userId} AND m."organizationId" = ${organizationId} AND m.status = 'Activo'
  `;
  if (!rows[0]) throw new DemoError("DENIED", "Sesión no autorizada.");
  const key = `${session.userId}:${organizationId}`;
  let state: DemoState = { version: 2, accountId: session.userId, organizationId, scenario: "normal", latency: 0,
    organizations: [], users: [], memberships: [rows[0].membership], roles: [], files: [], notifications: [], audit: [],
    preferences: rows[0].preference ? { [key]: rows[0].preference } : {} };
  const service = createMockService(() => state, (change) => { const next = structuredClone(state); change(next); state = next; });
  await service.updatePreferences(organizationId, changes);
  const payload = state.preferences[key];
  const event = state.audit[0];
  // Preferencia y auditoría se escriben juntas, en un único viaje al servidor.
  await tx.$executeRaw(Prisma.sql`
    WITH saved AS (
      INSERT INTO preferences ("userId", "organizationId", payload) VALUES (${session.userId}, ${organizationId}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT ("userId", "organizationId") DO UPDATE SET payload = EXCLUDED.payload RETURNING "userId"
    )
    INSERT INTO audit_events (id, "organizationId", "actorId", module, action, "entityId", before, after, "createdAt")
    SELECT ${event.id}, ${event.organizationId}, ${event.actorId}, ${event.module}, ${event.action}, ${event.entityId},
      ${JSON.stringify(event.before)}::jsonb, ${JSON.stringify(event.after)}::jsonb, ${event.createdAt} FROM saved
  `);
  return { preference: payload, event };
}
