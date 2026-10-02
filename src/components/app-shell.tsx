"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, Settings2, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { demoAdmin } from "@/lib/users";

const links = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/usuarios", label: "Usuarios", icon: UsersRound },
  { href: "/configuracion", label: "Configuración", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);
  useEffect(() => {
    if (menuOpen) asideRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [menuOpen]);

  return <div className="min-h-screen lg:pl-64">
    {menuOpen && <button type="button" aria-label="Cerrar menú lateral" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <aside ref={asideRef} id="menu-lateral" aria-label="Menú principal" className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface transition-transform duration-200 lg:visible lg:translate-x-0 ${menuOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
      <div className="flex h-20 items-center gap-3 border-b border-border px-6"><span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><LayoutDashboard size={20} /></span><span className="text-lg font-bold tracking-tight">Panel Admin</span><button type="button" aria-label="Cerrar menú" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} className="ml-auto rounded-lg p-1 text-muted lg:hidden"><X size={20} /></button></div>
      <nav className="px-3 py-6" aria-label="Navegación principal"><p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Principal</p>{links.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}><Icon size={19} strokeWidth={active ? 2.3 : 1.9} />{label}</Link>; })}</nav>
      <div className="absolute inset-x-5 bottom-6 rounded-xl border border-border bg-surface-muted px-4 py-3"><p className="text-xs font-semibold">Entorno de demostración</p><p className="mt-1 text-xs leading-5 text-muted">Los datos de este panel son ficticios.</p></div>
    </aside>
    <div className="min-w-0"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button ref={menuButtonRef} type="button" aria-label="Abrir menú" aria-controls="menu-lateral" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"><Menu size={20} /></button><div><p className="text-sm font-semibold">Panel de administración</p><p className="hidden text-xs text-muted sm:block">Espacio de trabajo</p></div></div><div className="flex items-center gap-3 sm:gap-5"><ThemeToggle /><div className="hidden h-8 w-px bg-border sm:block" /><div className="flex items-center gap-2.5"><Avatar name={demoAdmin.name} /><div className="hidden min-[480px]:block"><p className="text-sm font-semibold leading-5">{demoAdmin.name}</p><p className="text-xs text-muted">{demoAdmin.role}</p></div></div></div></header><main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9">{children}</main></div>
  </div>;
}
