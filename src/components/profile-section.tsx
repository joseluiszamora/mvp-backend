"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useDemo } from "@/components/demo-provider";
import { Avatar, Card, PageHeading } from "@/components/ui";
import { memberFor, type Preferences } from "@/lib/demo";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground";

export function ProfileSection() {
  const { state, service, setDirty, changePassword } = useDemo();
  const { setTheme } = useTheme();
  const account = state.users.find((item) => item.id === state.accountId)!;
  const [name, setName] = useState(account.name);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const key = `${state.accountId}:${state.organizationId}`;
  const preferences = state.preferences[key];
  const orgs = state.organizations.filter((org) => memberFor(state, state.accountId, org.id)?.status === "Activo");
  useEffect(() => { setName(account.name); }, [account.id, account.name]);
  async function save() { try { await service.updateProfile({ name }); setDirty(false); setMessage("Perfil guardado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); } }
  async function savePreference(changes: Partial<Preferences>) { try { await service.updatePreferences(state.organizationId, changes); setMessage("Preferencia guardada."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); } }
  function upload(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setMessage("Selecciona una imagen PNG, JPEG o WebP de hasta 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = async () => { if (typeof reader.result !== "string") return; try { await service.updateProfile({ avatar: reader.result }); setMessage("Avatar actualizado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el avatar."); } };
    reader.onerror = () => setMessage("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  }
  return <>
    <PageHeading eyebrow="Cuenta" title="Perfil" description="Datos de tu cuenta." />
    {message && <p role="status" className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-5 flex items-center gap-3">{account.avatar ? <img alt="Avatar actual" src={account.avatar} className="size-11 rounded-full object-cover" /> : <Avatar name={account.name} size="lg" />}<span className="text-sm text-muted">Avatar de tu cuenta</span></div>
        <label className="block text-sm">Nombre<input className={field} value={name} onChange={(event) => { setName(event.target.value); setDirty(true); }} /></label>
        <label className="mt-4 block text-sm">Cambiar avatar<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0])} /></label>
        <p className="mt-4 text-sm">Correo: {account.email}</p>
        <p className="mt-2 text-sm">Rol: {state.roles.find((item) => item.id === memberFor(state, account.id)?.roleId)?.name}</p>
        <p className="mt-2 text-sm">Empresas: {orgs.map((item) => item.name).join(", ")}</p>
        <button className="mt-4 rounded-lg border border-border px-3 py-2 text-sm" onClick={save}>Guardar perfil</button>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Preferencias personales</h2>
        <label className="block text-sm">Tema<select className={field} value={preferences?.theme ?? "system"} onChange={(event) => { const theme = event.target.value as Preferences["theme"]; setTheme(theme); savePreference({ theme }); }}><option value="system">Automático</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
        <label className="block text-sm">Idioma inicial<select className={field} value={preferences?.locale ?? "es-BO"} onChange={(event) => savePreference({ locale: event.target.value })}><option value="es-BO">Español (Bolivia)</option><option value="es-ES">Español (España)</option></select></label>
        <label className="block text-sm">Densidad de tablas<select className={field} value={preferences?.density ?? "Cómoda"} onChange={(event) => savePreference({ density: event.target.value as Preferences["density"] })}><option>Cómoda</option><option>Compacta</option></select></label>
        <p className="text-xs text-muted">Estas preferencias se guardan en el servidor para esta cuenta y empresa.</p>
      </Card>
      <Card className="p-5 lg:col-span-2">
        <h2 className="font-bold">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-muted">Al guardarla se cierran todas tus sesiones y deberás entrar de nuevo.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); try { await changePassword(currentPassword, newPassword); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cambiar la contraseña."); } }}>
          <label className="text-sm">Contraseña actual<input className={field} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="text-sm">Contraseña nueva<input className={field} type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <button className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">Guardar contraseña</button>
        </form>
      </Card>
    </div>
  </>;
}
