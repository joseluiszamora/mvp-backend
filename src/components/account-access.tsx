"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo-provider";

export function AccountAccess({ userId }: { userId: string }) {
  const { provisionUser } = useDemo();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function provision(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await provisionUser(userId, password); setPassword(""); setMessage("Acceso actualizado. Entrega la contraseña por un canal seguro; las sesiones anteriores quedaron revocadas."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo habilitar el acceso."); }
    finally { setBusy(false); }
  }
  return <form className="mt-5 border-t border-border pt-4" onSubmit={provision}>
    <h3 className="font-semibold">Acceso de esta cuenta</h3>
    <p className="mt-1 text-xs text-muted">Establecer una contraseña revoca las sesiones anteriores. No se envía ningún correo.</p>
    <label className="mt-3 block text-sm">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button className="mt-3 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50" disabled={busy}>Establecer acceso</button>
    {message && <p role="status" className="mt-2 text-sm text-muted">{message}</p>}
  </form>;
}
