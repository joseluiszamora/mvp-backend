import Link from "next/link";
import { redirect } from "next/navigation";
import { type ModuleId } from "@/lib/demo";
import { canAccessModule, currentSession } from "@/lib/server/panel";

export async function ProtectedPage({ module, children }: { module: ModuleId; children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/");
  if (!await canAccessModule(session, module)) return <div role="alert" className="rounded-xl border border-border bg-surface p-8"><h1 className="text-xl font-bold">Acceso denegado</h1><p className="mt-2 text-muted">Este módulo no está disponible para tu rol o empresa.</p><Link href="/" className="mt-4 inline-block text-accent-text underline">Volver al inicio</Link></div>;
  return children;
}
