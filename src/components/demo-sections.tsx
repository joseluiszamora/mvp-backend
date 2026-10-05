"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo-provider";
import { Card, PageHeading } from "@/components/ui";
import { membersForOrganization, modules, visibleModule, type ModuleId } from "@/lib/demo";

const button = "rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted";

export function Dashboard() { const { state } = useDemo(); const org = state.organizationId; const users = membersForOrganization(state, org); const files = state.files.filter((item) => item.organizationId === org); const notes = state.notifications.filter((item) => item.organizationId === org && item.userId === state.accountId); const events = state.audit.filter((item) => item.organizationId === org); const favorites = state.preferences[`${state.accountId}:${org}`]?.favorites ?? []; const stats = [{ label: "Usuarios activos", count: users.filter((item) => item.status === "Activo").length, id: "users" as ModuleId }, { label: "Archivos", count: files.length, id: "files" as ModuleId }, { label: "Notificaciones pendientes", count: notes.filter((item) => !item.readAt).length, id: "notifications" as ModuleId }, { label: "Actividad reciente", count: events.length, id: "audit" as ModuleId }].filter((item) => visibleModule(state, item.id)); return <><PageHeading eyebrow="Vista general" title="Inicio" description="Indicadores de la empresa seleccionada, derivados de los datos ficticios." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((item) => <Card key={item.label} className="p-5"><p className="text-sm text-muted">{item.label}</p><p className="mt-5 text-3xl font-bold">{item.count}</p></Card>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-2"><Card className="p-5"><h2 className="font-bold">Actividad de muestra</h2><div className="mt-5 flex h-28 items-end gap-3" role="img" aria-label="Gráfica de actividad demo de siete días">{[3, 6, 4, 8, 5, 7, 9].map((n, i) => <div key={i} className="flex-1 rounded-t bg-accent" style={{ height: `${n * 10}%` }} />)}</div><p className="mt-3 text-xs text-muted">Datos semilla deterministas.</p></Card><Card className="p-5"><h2 className="font-bold">Accesos rápidos</h2><div className="mt-4 flex flex-wrap gap-2">{modules.filter((item) => item.id !== "dashboard" && visibleModule(state, item.id) && (!favorites.length || favorites.includes(item.id))).slice(0, 5).map((item) => <Link key={item.id} className={button} href={item.href}>{item.label}</Link>)}</div></Card></div></>; }






