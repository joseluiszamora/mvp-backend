import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { defaultPreferences, type AuditEvent, type DemoState, type Notification } from "@/lib/demo";
import { getDatabase, lockPanel } from "@/lib/server/database";

type QueuedEmail = { id: string; organizationId: string; userId: string; recipient: string; subject: string; body: string;
  status: string; attempts: number; nextAttemptAt: bigint; createdAt: bigint };

const routes: Record<string, string> = { usuarios: "/usuarios", roles: "/roles", archivos: "/archivos", empresa: "/empresa",
  configuración: "/configuracion", perfil: "/perfil", preferencias: "/configuracion" };

export function prepareNotifications(state: DemoState, events: AuditEvent[]): QueuedEmail[] {
  const queued: QueuedEmail[] = [];
  for (const event of events) {
    const category: Notification["category"] = ["configuración", "empresa", "roles"].includes(event.module) ? "sistema" : "actividad";
    const organization = state.organizations.find((item) => item.id === event.organizationId);
    const title = `Actividad en ${organization?.name ?? "la empresa"}`;
    const message = `Se registró una acción de ${event.module}: ${event.action}.`;
    for (const membership of state.memberships) {
      if (membership.organizationId !== event.organizationId || membership.status !== "Activo" || membership.userId === event.actorId) continue;
      const preferences = state.preferences[`${membership.userId}:${event.organizationId}`] ?? defaultPreferences();
      if (preferences.notificationCategories?.[category] === false) continue;
      if (preferences.notificationChannels?.panel !== false) {
        const note: Notification = { id: crypto.randomUUID(), organizationId: event.organizationId, userId: membership.userId,
          title, message, category, readAt: null, createdAt: new Date().toISOString(), targetRoute: routes[event.module] };
        state.notifications.push(note);
      }
      if (preferences.notificationChannels?.correo) {
        const user = state.users.find((item) => item.id === membership.userId);
        if (user) queued.push({ id: crypto.randomUUID(), organizationId: event.organizationId, userId: user.id,
          recipient: user.email, subject: title, body: `${message}\n\nEntra al panel para consultar la actividad.`,
          status: "pending", attempts: 0, nextAttemptAt: BigInt(Date.now()), createdAt: BigInt(Date.now()) });
      }
    }
  }
  return queued;
}

export async function queueEmails(tx: Prisma.TransactionClient, emails: QueuedEmail[]): Promise<void> {
  if (emails.length) await tx.emailOutbox.createMany({ data: emails });
}

export function emailConfigured(): boolean { return !!(process.env.RESEND_API_KEY?.startsWith("re_") && process.env.PANEL_EMAIL_FROM?.includes("@")); }

export async function dispatchOutbox(limit = 10): Promise<number> {
  if (!emailConfigured()) return 0;
  const db = await getDatabase();
  const now = BigInt(Date.now());
  const claimed = await db.$transaction(async (tx) => {
    await lockPanel(tx);
    const items = await tx.emailOutbox.findMany({ where: { status: { in: ["pending", "retry", "sending"] }, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 20) });
    for (const item of items) await tx.emailOutbox.update({ where: { id: item.id }, data: { status: "sending", attempts: { increment: 1 }, nextAttemptAt: now + 60_000n } });
    return items;
  });
  for (const item of claimed) {
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(8_000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": item.id },
        body: JSON.stringify({ from: process.env.PANEL_EMAIL_FROM, to: [item.recipient], subject: item.subject, text: item.body }) });
      if (!response.ok) throw new Error(`Proveedor: HTTP ${response.status}`);
      const payload = await response.json() as { id?: string };
      await db.emailOutbox.update({ where: { id: item.id }, data: { status: "sent", sentAt: BigInt(Date.now()), providerId: payload.id ?? null, lastError: null } });
    } catch (error) {
      const attempts = item.attempts + 1;
      await db.emailOutbox.update({ where: { id: item.id }, data: { status: attempts >= 5 ? "failed" : "retry",
        nextAttemptAt: BigInt(Date.now() + Math.min(2 ** attempts * 60_000, 3_600_000)), lastError: error instanceof Error ? error.message.slice(0, 160) : "Error de entrega" } });
    }
  }
  return claimed.length;
}
