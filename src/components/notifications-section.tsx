"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Card, PageHeading } from "@/components/ui";
import { modules, permissionFor, visibleModule, type Notification } from "@/lib/demo";

export function NotificationsSection() {
  const { state, service } = useDemo();
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [delivery, setDelivery] = useState<Record<string, number> | null>(null);
  useEffect(() => { fetch("/api/notifications/config", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
    .then((value: { emailAvailable?: boolean } | null) => setEmailAvailable(!!value?.emailAvailable)).catch(() => setEmailAvailable(false)); }, []);
  const canManageSettings = permissionFor(state, "settings.manage");
  useEffect(() => { if (!canManageSettings) return; fetch("/api/notifications/delivery", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null).then((value: { counts?: Record<string, number> } | null) => setDelivery(value?.counts ?? null))
    .catch(() => setDelivery(null)); }, [canManageSettings, state.accountId, state.organizationId]);
  useEffect(() => { let live = true; service.listNotifications(state.organizationId).then((items) => { if (live) { setNotes(items); setLoading(false); setMessage(""); } }).catch((error) => { if (live) { setLoading(false); setMessage(error instanceof Error ? error.message : "No se pudieron cargar las notificaciones."); } }); return () => { live = false; }; }, [service, state.organizationId, state.accountId, state.notifications, state.scenario, state.latency]);
  const unread = notes.filter((item) => !item.readAt).length;
  const key = `${state.accountId}:${state.organizationId}`;
  const channels = state.preferences[key]?.notificationChannels ?? { panel: true, correo: false };
  const categories = state.preferences[key]?.notificationCategories ?? { actividad: true, sistema: true };
  async function mark(ids: string[]) { try { await service.markNotifications(state.organizationId, ids); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar."); } }
  async function setChannel(channel: "panel" | "correo", enabled: boolean) { try { await service.updatePreferences(state.organizationId, { notificationChannels: { ...channels, [channel]: enabled } }); setMessage("Preferencia guardada."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); } }
  async function setCategory(category: "actividad" | "sistema", enabled: boolean) { try { await service.updatePreferences(state.organizationId, { notificationCategories: { ...categories, [category]: enabled } }); setMessage("Preferencia guardada."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); } }
  return <><PageHeading eyebrow="Actividad" title="Notificaciones" description={`${unread} sin leer. Avisos de actividad de tu empresa.`} aside={<button className="rounded-lg border border-border px-3 py-2 text-sm" disabled={!unread} onClick={() => mark(notes.map((item) => item.id))}>Marcar todas como leídas</button>} />
    {message && state.scenario !== "error" && <p role="status" className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">{message}</p>}
    {delivery && <p className="mb-4 text-sm text-muted">Correo: {delivery.pending ?? 0} pendientes · {delivery.retry ?? 0} en reintento · {delivery.failed ?? 0} fallidos.</p>}
    <Card className="mb-5 p-5"><h2 className="font-bold">Preferencias de envío</h2><div className="mt-3 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={channels.panel} onChange={(event) => setChannel("panel", event.target.checked)} />Panel</label><label className="flex items-center gap-2"><input type="checkbox" checked={channels.correo} disabled={!emailAvailable} onChange={(event) => setChannel("correo", event.target.checked)} />Correo{!emailAvailable && " · no configurado"}</label></div><div className="mt-3 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={categories.actividad} onChange={(event) => setCategory("actividad", event.target.checked)} />Actividad</label><label className="flex items-center gap-2"><input type="checkbox" checked={categories.sistema} onChange={(event) => setCategory("sistema", event.target.checked)} />Sistema</label></div></Card>
    <Card className="p-5">{loading ? <p role="status" className="py-10 text-center text-muted">Cargando notificaciones…</p> : message && state.scenario === "error" ? <p role="alert" className="py-10 text-center text-muted">{message}</p> : notes.length === 0 ? <p className="py-10 text-center text-muted">No hay notificaciones.</p> : <ul className="divide-y divide-border">{notes.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{item.title}{!item.readAt && " · Nueva"}</p><p className="text-sm text-muted">{item.message}</p></div><div className="flex gap-3">{item.targetRoute && modules.some((module) => module.href === item.targetRoute && visibleModule(state, module.id)) && <Link href={item.targetRoute} className="text-sm text-accent-text underline">Abrir</Link>}{!item.readAt && <button className="text-sm text-accent-text underline" onClick={() => mark([item.id])}>Marcar leída</button>}</div></li>)}</ul>}</Card>
  </>;
}
