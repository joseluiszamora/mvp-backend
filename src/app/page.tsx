import Link from "next/link";
import { ArrowRight, CircleCheck, Clock3, UsersRound } from "lucide-react";
import { Avatar, Badge, Card, PageHeading } from "@/components/ui";
import { formatDate, users } from "@/lib/users";

export default function HomePage() {
  const active = users.filter((user) => user.status === "Activo").length;
  const stats = [
    { label: "Total de usuarios", value: users.length, icon: UsersRound, description: "Registrados en el panel" },
    { label: "Usuarios activos", value: active, icon: CircleCheck, description: "Con acceso habilitado" },
    { label: "Usuarios inactivos", value: users.length - active, icon: Clock3, description: "Sin actividad actual" },
  ];
  const recent = [...users].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 5);
  return <><PageHeading eyebrow="Vista general" title="Bienvenido al panel" description="Un resumen sencillo de tu espacio de trabajo y sus usuarios." aside={<span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted">Datos de demostración</span>} />
    <section aria-label="Resumen de usuarios" className="grid gap-4 md:grid-cols-3">{stats.map(({ label, value, icon: Icon, description }) => <Card key={label} className="p-5 sm:p-6"><div className="mb-6 flex items-start justify-between"><span className="text-sm font-medium text-muted">{label}</span><span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon size={20} /></span></div><p className="text-3xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs text-muted">{description}</p></Card>)}</section>
    <section className="mt-7"><Card><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6"><div><h2 className="text-base font-bold">Usuarios recientes</h2><p className="mt-1 text-sm text-muted">Las últimas incorporaciones al panel.</p></div><Link href="/usuarios" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-accent-text hover:underline">Ver todos <ArrowRight size={16} /></Link></div><ul className="divide-y divide-border">{recent.map((user) => <li key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"><Avatar name={user.name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div><span className="hidden text-xs text-muted sm:block">{formatDate(user.joinedAt)}</span><Badge active={user.status === "Activo"} /></li>)}</ul></Card></section>
  </>;
}
