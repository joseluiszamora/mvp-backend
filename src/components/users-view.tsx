"use client";

import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDemo } from "@/components/demo-provider";
import { AccountAccess } from "@/components/account-access";
import { Modal } from "@/components/modal";
import { Avatar, Badge, Card, PageHeading } from "@/components/ui";
import { membersForOrganization, permissionFor, type MemberUser, type PageResult } from "@/lib/demo";
import { maxAvatarBytes } from "@/lib/file-signature";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground";
const avatarTypes = ["image/png", "image/jpeg", "image/webp"];

export function UsersView() {
  const { state, service, refresh, dirty, setDirty } = useDemo();
  const org = state.organizationId;
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<MemberUser | null>(null);
  const [viewing, setViewing] = useState<MemberUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [readingAvatar, setReadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const search = useDebouncedValue(query);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PageResult<MemberUser> | null>(null);

  useEffect(() => {
    setSelected([]);
    setPage(1);
    setEditing(null);
    setViewing(null);
    setCreating(false);
    setAvatarDraft("");
    setDirty(false);
  }, [org, setDirty]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    service.listUsers({ organizationId: org, search, roleId: role || undefined, status: status as MemberUser["status"] || undefined, sort, page, pageSize: 8 })
      .then((value) => { if (active) { setResult(value); setLoadError(""); } })
      .catch((cause) => { if (active) { setResult(null); setLoadError(cause instanceof Error ? cause.message : "No se pudieron cargar los usuarios."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [service, org, search, role, status, sort, page, state.scenario, state.latency, state.users, state.memberships]);

  const roles = state.roles.filter((item) => item.organizationId === org);
  const filtered = useMemo(() => membersForOrganization(state, org)
    .filter((item) => (item.name + item.email).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")) && (!role || item.roleId === role) && (!status || item.status === status))
    .sort((a, b) => (sort === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "es")), [state, org, query, role, status, sort]);
  const shown = result?.items ?? [];
  const compact = state.preferences[`${state.accountId}:${org}`]?.density === "Compacta";
  const columns = state.preferences[`${state.accountId}:${org}`]?.tableColumns ?? ["role", "status", "date"];
  const canCreate = permissionFor(state, "users.create");
  const canUpdate = permissionFor(state, "users.update");
  const canDeactivate = permissionFor(state, "users.deactivate");
  const canExport = permissionFor(state, "users.export");
  const timezone = state.organizations.find((company) => company.id === org)?.timezone ?? "America/La_Paz";

  function openCreate() {
    setEditing(null);
    setViewing(null);
    setAvatarDraft("");
    setAvatarError("");
    setError("");
    setDirty(false);
    setCreating(true);
  }

  function openEdit(item: MemberUser) {
    setEditing(item);
    setViewing(null);
    setAvatarDraft(item.avatar ?? "");
    setAvatarError("");
    setError("");
    setDirty(false);
    setCreating(false);
  }

  function chooseAvatar(file?: File) {
    if (!file) return;
    setAvatarError("");
    if (!avatarTypes.includes(file.type) || file.size < 1 || file.size > maxAvatarBytes) {
      setAvatarError("Selecciona una imagen PNG, JPEG o WebP de hasta 2 MB.");
      return;
    }
    setDirty(true);
    setReadingAvatar(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReadingAvatar(false);
      if (typeof reader.result !== "string") {
        setAvatarError("No se pudo leer la fotografía.");
        return;
      }
      setAvatarDraft(reader.result);
    };
    reader.onerror = () => { setReadingAvatar(false); setAvatarError("No se pudo leer la fotografía."); };
    reader.readAsDataURL(file);
  }

  async function save(form: FormData) {
    const avatarChanged = editing
      ? avatarDraft !== (editing.avatar ?? "")
      : avatarDraft.length > 0;
    const avatarChange = avatarChanged ? { avatar: avatarDraft || null } : {};
    try {
      await service.saveUser({
        id: editing?.id,
        organizationId: org,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        roleId: String(form.get("role") ?? ""),
        ...avatarChange,
      });
      setEditing(null);
      setCreating(false);
      setAvatarDraft("");
      setDirty(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el usuario.");
    }
  }

  async function deactivate(ids: string[]) {
    if (!window.confirm(`¿Cambiar el estado de ${ids.length} usuario(s)?`)) return;
    try {
      await service.changeUserStatus(org, ids);
      setSelected([]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado.");
    }
  }

  function closeEditor() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    setEditing(null);
    setCreating(false);
    setAvatarDraft("");
    setAvatarError("");
    setDirty(false);
  }

  function exportCsv() {
    if (!canExport) return;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const content = ["Nombre,Correo,Rol,Estado", ...filtered.map((item) => [item.name, item.email, roles.find((r) => r.id === item.roleId)?.name ?? "", item.status].map(escape).join(","))].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    link.download = `usuarios-${org}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <>
    <PageHeading eyebrow="Gestión" title="Usuarios" description="Usuarios de la empresa seleccionada." aside={<div className="flex gap-2">{canExport && <button className="rounded-lg border border-border px-3 py-2 text-sm" onClick={exportCsv}>Exportar CSV</button>}{canCreate && <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background" onClick={openCreate}>Crear usuario</button>}</div>} />
    {error && <p role="alert" className="mb-4 rounded-lg bg-surface-muted p-3 text-sm">{error}</p>}
    <Card className="p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Buscar<input className={field} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nombre o correo" /></label>
        <label className="text-sm">Rol<select className={field} value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">Todos</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm">Estado<select className={field} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos</option><option>Activo</option><option>Inactivo</option></select></label>
        <label className="text-sm">Orden<select className={field} value={sort} onChange={(event) => { setSort(event.target.value as "asc" | "desc"); setPage(1); }}><option value="asc">Nombre A–Z</option><option value="desc">Nombre Z–A</option></select></label>
      </div>
      <p className="mt-4 text-sm text-muted">{result?.total ?? 0} resultados</p>
      {canDeactivate && selected.length > 0 && <button className="mt-2 rounded-lg border border-border px-3 py-2 text-sm" onClick={() => void deactivate(selected)}>Cambiar estado de {selected.length}</button>}
      {loading ? <p role="status" className="py-12 text-center text-muted">Cargando usuarios…</p> : loadError ? <div role="alert" className="py-12 text-center"><p>No se pudieron cargar los usuarios.</p><button className="mt-2 text-accent-text underline" onClick={() => void refresh()}>Reintentar</button></div> : shown.length === 0 ? <p className="py-12 text-center text-muted">No se encontraron usuarios.</p> : <div className="mt-4 overflow-x-auto">
        <table className={`w-full min-w-[650px] text-left text-sm ${compact ? "demo-table-compact" : ""}`}>
          <thead><tr className="border-b border-border text-muted">{canDeactivate && <th className="p-3">Elegir</th>}<th className="p-3">Usuario</th>{columns.includes("role") && <th className="p-3">Rol</th>}{columns.includes("status") && <th className="p-3">Estado</th>}{columns.includes("date") && <th className="p-3">Fecha</th>}<th className="p-3">Acciones</th></tr></thead>
          <tbody>{shown.map((item) => <tr key={item.id} className="border-b border-border">
            {canDeactivate && <td className="p-3"><input aria-label={`Seleccionar ${item.name}`} type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /></td>}
            <td className="p-3"><div className="flex items-center gap-2"><Avatar name={item.name} photo={item.avatar} /><span><strong className="block">{item.name}</strong><small className="text-muted">{item.email}</small></span></div></td>
            {columns.includes("role") && <td className="p-3">{roles.find((r) => r.id === item.roleId)?.name}</td>}
            {columns.includes("status") && <td className="p-3"><Badge active={item.status === "Activo"} /></td>}
            {columns.includes("date") && <td className="p-3">{new Intl.DateTimeFormat("es-BO", { timeZone: timezone }).format(new Date(item.createdAt))}</td>}
            <td className="p-3"><div className="flex gap-2"><button className="text-accent-text underline" onClick={() => setViewing(item)}>Perfil</button>{canUpdate && <button className="text-accent-text underline" onClick={() => openEdit(item)}>Editar</button>}{canDeactivate && <button className="text-accent-text underline" onClick={() => void deactivate([item.id])}>{item.status === "Activo" ? "Desactivar" : "Activar"}</button>}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-4 flex items-center justify-between text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil((result?.total ?? 0) / 8))}</span><button disabled={page * 8 >= (result?.total ?? 0)} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </Card>

    {viewing && <Modal titleId="user-profile-dialog-title" onClose={() => setViewing(null)}>
      <div className="flex items-center gap-4">
        <Avatar name={viewing.name} photo={viewing.avatar} size="lg" />
        <div><h2 id="user-profile-dialog-title" className="text-xl font-bold">Perfil de usuario</h2><p className="mt-1 text-sm text-muted">{viewing.name}</p></div>
      </div>
      <dl className="mt-5 divide-y divide-border text-sm">
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted">Correo</dt><dd className="break-all text-right">{viewing.email}</dd></div>
        <div className="flex justify-between gap-2 py-3"><dt className="text-muted">Rol</dt><dd>{roles.find((item) => item.id === viewing.roleId)?.name ?? "Sin rol"}</dd></div>
        <div className="flex justify-between gap-2 py-3"><dt className="text-muted">Estado</dt><dd><Badge active={viewing.status === "Activo"} /></dd></div>
        <div className="flex justify-between gap-2 py-3"><dt className="text-muted">Fecha de alta</dt><dd>{new Intl.DateTimeFormat("es-BO", { dateStyle: "long", timeZone: timezone }).format(new Date(viewing.createdAt))}</dd></div>
      </dl>
      <div className="mt-4 flex justify-end"><button type="button" onClick={() => setViewing(null)} className="rounded-lg border border-border px-3 py-2">Cerrar</button></div>
    </Modal>}

    {(editing || creating) && <Modal titleId="user-dialog-title" onClose={closeEditor}>
      <h2 id="user-dialog-title" className="text-xl font-bold">{editing ? "Editar usuario" : "Crear usuario"}</h2>
      <form action={save} onInput={() => setDirty(true)} className="mt-4 space-y-3">
        <label className="block text-sm">Nombre<input name="name" autoFocus className={field} defaultValue={editing?.name} required /></label>
        <label className="block text-sm">Correo<input name="email" type="email" className={field} defaultValue={editing?.email} required /></label>
        <label className="block text-sm">Rol<select name="role" className={field} defaultValue={editing?.roleId ?? roles[2]?.id} disabled={!permissionFor(state, "roles.manage")}>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!permissionFor(state, "roles.manage") && <input type="hidden" name="role" value={editing?.roleId ?? roles[2]?.id} />}</label>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium">Fotografía</p>
          <div className="flex items-center gap-3"><Avatar name={editing?.name ?? "Nuevo usuario"} photo={avatarDraft || null} size="lg" /><label className="flex-1 text-sm">Subir fotografía<input className={`${field} mt-1`} type="file" accept="image/png,image/jpeg,image/webp" disabled={readingAvatar} onChange={(event) => chooseAvatar(event.currentTarget.files?.[0])} /></label></div>
          <p className="mt-2 text-xs text-muted">PNG, JPEG o WebP. Máximo 2 MB.</p>
          {readingAvatar && <p role="status" className="mt-2 text-sm text-muted">Leyendo fotografía…</p>}
          {avatarDraft && <button type="button" disabled={readingAvatar} className="mt-2 text-sm text-accent-text underline disabled:opacity-50" onClick={() => { setAvatarDraft(""); setDirty(true); }}>Quitar fotografía</button>}
          {avatarError && <p role="alert" className="mt-2 text-sm text-accent-text">{avatarError}</p>}
        </div>
        {editing && permissionFor(state, "roles.manage") && <AccountAccess userId={editing.id} />}
        <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={closeEditor} className="rounded-lg border border-border px-3 py-2">Cerrar</button><button disabled={readingAvatar} className="rounded-lg bg-accent px-3 py-2 text-background disabled:opacity-50">Guardar</button></div>
      </form>
    </Modal>}
  </>;
}
