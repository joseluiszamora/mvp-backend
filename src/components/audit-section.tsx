"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Modal } from "@/components/modal";
import { Card, PageHeading } from "@/components/ui";
import type { AuditEvent } from "@/lib/demo";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground";

export function AuditSection() {
  const { state, service } = useDemo();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [module, setModule] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [detail, setDetail] = useState<AuditEvent | null>(null);
  const [integrity, setIntegrity] = useState("");
  async function checkIntegrity() {
    setIntegrity("Comprobando integridad…");
    try {
      const response = await fetch("/api/audit/integrity", { cache: "no-store" });
      const result = await response.json() as { valid?: boolean; events?: number; issue?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo comprobar la auditoría.");
      setIntegrity(result.valid ? `Integridad verificada: ${result.events ?? 0} sellos.` : result.issue ?? "Se detectó una alteración.");
    } catch (error) { setIntegrity(error instanceof Error ? error.message : "No se pudo comprobar la auditoría."); }
  }
  useEffect(() => {
    let live = true;
    service.listAudit(state.organizationId, { page: 1, pageSize: 500 }).then((result) => { if (live) { setEvents(result.items); setLoading(false); setError(""); } }).catch((reason) => { if (live) { setError(reason instanceof Error ? reason.message : "No se pudo cargar la auditoría."); setLoading(false); } });
    return () => { live = false; };
  }, [service, state.organizationId, state.audit, state.scenario, state.latency]);
  const rows = events.filter((item) => (!module || item.module === module) && (!actor || item.actorId === actor) && (!from || item.createdAt.slice(0, 10) >= from) && (!until || item.createdAt.slice(0, 10) <= until));
  return <>
    <PageHeading eyebrow="Registro" title="Auditoría" description="Eventos de la empresa activa." aside={<button className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => void checkIntegrity()}>Comprobar integridad</button>} />
    {integrity && <p role="status" className="mb-4 rounded-lg bg-surface-muted p-3 text-sm">{integrity}</p>}
    <Card className="p-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Módulo<select className={field} value={module} onChange={(event) => setModule(event.target.value)}><option value="">Todos</option>{[...new Set(events.map((item) => item.module))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-sm">Actor<select className={field} value={actor} onChange={(event) => setActor(event.target.value)}><option value="">Todos</option>{[...new Set(events.map((item) => item.actorId))].map((item) => <option key={item} value={item}>{state.users.find((user) => user.id === item)?.name ?? item}</option>)}</select></label>
        <label className="text-sm">Desde<input className={field} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-sm">Hasta<input className={field} type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
      </div>
      {loading ? <p role="status" className="py-10 text-center text-muted">Cargando eventos…</p> : error ? <p role="alert" className="py-10 text-center text-muted">{error}</p> : rows.length === 0 ? <p className="py-10 text-center text-muted">No hay eventos.</p> : <ul className="mt-4 divide-y divide-border">{rows.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{item.module} · {item.action} · {item.entityId} · {state.users.find((user) => user.id === item.actorId)?.name ?? item.actorId} · {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</span><button className="text-accent-text underline" onClick={() => setDetail(item)}>Ver detalle</button></li>)}</ul>}
    </Card>
    {detail && <Modal titleId="audit-detail-title" onClose={() => setDetail(null)}><h2 id="audit-detail-title" className="font-bold">{detail.module} · {detail.action}</h2><pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-surface-muted p-3 text-xs">{JSON.stringify({ anterior: detail.before, posterior: detail.after }, null, 2)}</pre><button className="mt-4 rounded-lg border border-border px-3 py-2 text-sm" onClick={() => setDetail(null)}>Cerrar</button></Modal>}
  </>;
}
