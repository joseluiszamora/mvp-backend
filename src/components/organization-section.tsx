"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Card, PageHeading } from "@/components/ui";
import { permissionFor } from "@/lib/demo";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground";
const button = "rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted disabled:opacity-50";

export function OrganizationSection() {
  const { state, service, setDirty } = useDemo();
  const org = state.organizations.find((item) => item.id === state.organizationId)!;
  const canManage = permissionFor(state, "organization.manage");
  const [name, setName] = useState(org.name);
  const [branchName, setBranchName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<"Activa" | "Inactiva">("Activa");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setName(org.name); setEditing(null); }, [org.id, org.name]);
  async function run(work: () => Promise<void>, success: string) {
    setBusy(true); setMessage("");
    try { await work(); setDirty(false); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading eyebrow="Organización" title="Empresa y sucursales" description="Datos de la empresa activa." />
    {message && <p role="status" className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <label className="text-sm">Nombre comercial<input className={field} value={name} disabled={!canManage || busy} onChange={(event) => { setName(event.target.value); setDirty(true); }} /></label>
        <p className="mt-3 text-sm text-muted">Moneda: {org.currency} · Zona horaria: {org.timezone}</p>
        {canManage && <button className={`${button} mt-4`} disabled={busy} onClick={() => run(() => service.updateOrganization(org.id, { name }), "Empresa guardada.")}>Guardar empresa</button>}
      </Card>
      <Card className="p-5">
        <h2 className="font-bold">Sucursales</h2>
        {org.branches.length === 0 ? <p className="mt-3 text-sm text-muted">No hay sucursales.</p> : <ul className="mt-3 divide-y divide-border">{org.branches.map((item) => <li key={item.id} className="py-3 text-sm">
          {editing === item.id ? <div className="grid gap-2">
            <label>Nombre<input className={field} value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
            <label>Dirección<input className={field} value={editAddress} onChange={(event) => setEditAddress(event.target.value)} /></label>
            <label>Estado<select className={field} value={editStatus} onChange={(event) => setEditStatus(event.target.value as "Activa" | "Inactiva")}><option>Activa</option><option>Inactiva</option></select></label>
            <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => run(async () => { await service.updateBranch(org.id, item.id, { name: editName, address: editAddress, status: editStatus }); setEditing(null); }, "Sucursal actualizada.")}>Guardar</button><button className={button} onClick={() => setEditing(null)}>Cancelar</button></div>
          </div> : <div className="flex flex-wrap items-center justify-between gap-2"><span>{item.name} · {item.address || "Sin dirección"} · {item.status}</span>{canManage && <button className="text-accent-text underline" onClick={() => { setEditing(item.id); setEditName(item.name); setEditAddress(item.address); setEditStatus(item.status); }}>Editar</button>}</div>}
        </li>)}</ul>}
        {canManage && <div className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-40 flex-1 text-sm">Nueva sucursal<input className={field} value={branchName} onChange={(event) => setBranchName(event.target.value)} /></label><button className={button} disabled={busy} onClick={() => run(async () => { await service.addBranch(org.id, branchName); setBranchName(""); }, "Sucursal agregada.")}>Agregar</button></div>}
      </Card>
    </div>
  </>;
}
