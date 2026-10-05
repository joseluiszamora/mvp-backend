"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { Card, PageHeading } from "@/components/ui";
import { type Permission, type Role } from "@/lib/demo";

const permissions: Permission[] = ["users.read", "users.create", "users.update", "users.deactivate", "users.export", "roles.manage", "settings.manage", "files.read", "files.manage", "audit.read", "organization.manage"];
const permissionLabels: Record<Permission, string> = { "users.read": "Usuarios · Ver", "users.create": "Usuarios · Crear", "users.update": "Usuarios · Editar", "users.deactivate": "Usuarios · Desactivar", "users.export": "Usuarios · Exportar", "roles.manage": "Roles · Administrar", "settings.manage": "Configuración · Administrar", "files.read": "Archivos · Ver", "files.manage": "Archivos · Administrar", "audit.read": "Auditoría · Ver", "organization.manage": "Empresa · Administrar" };

export function RolesSection() {
  const { state, service } = useDemo();
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const org = state.organizationId;
  useEffect(() => { let active = true; setLoading(true); service.listRoles(org).then((items) => { if (active) setRoles(items); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudieron cargar los roles."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [service, org, state.roles, state.scenario]);
  async function create() { try { await service.createRole(org, name); setName(""); setMessage("Rol creado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el rol."); } }
  async function toggle(role: Role, code: Permission) { try { await service.setRolePermission(org, role.id, code, !role.permissions.includes(code)); setMessage("Permisos actualizados."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron actualizar los permisos."); } }
  return <><PageHeading eyebrow="Acceso" title="Roles y permisos" description="La matriz simula los permisos de esta empresa." />{message && <p role="status" className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">{message}</p>}<Card className="p-5"><div className="flex flex-wrap items-end gap-2"><label className="min-w-48 flex-1 text-sm">Nuevo rol<input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="rounded-lg border border-border px-3 py-2 text-sm" onClick={create}>Crear rol</button></div>{loading ? <p role="status" className="py-10 text-center text-muted">Cargando roles…</p> : roles.length === 0 ? <p className="py-10 text-center text-muted">No hay roles para mostrar.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr><th className="p-2 text-left">Permiso</th>{roles.map((role) => <th className="p-2" key={role.id}>{role.name}{role.protected && " · Base"}</th>)}</tr></thead><tbody>{permissions.map((code) => <tr key={code} className="border-t border-border"><th className="p-2 text-left font-normal">{permissionLabels[code]}</th>{roles.map((role) => <td className="p-2 text-center" key={role.id}><input type="checkbox" aria-label={`${permissionLabels[code]} para ${role.name}`} checked={role.permissions.includes(code)} disabled={role.protected} onChange={() => toggle(role, code)} /></td>)}</tr>)}</tbody></table></div>}</Card></>;
}
