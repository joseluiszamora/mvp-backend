"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings2, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { Avatar } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { demoAdmin } from "@/lib/users";

const links = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/usuarios", label: "Usuarios", icon: UsersRound },
  { href: "/configuracion", label: "Configuración", icon: Settings2 },
];
const sidebarStorageKey = "panel-admin-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(sidebarStorageKey) === "true"); } catch {
      // The control remains usable when browser storage is unavailable.
    }
  }, []);
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

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(sidebarStorageKey, String(next)); } catch {
      // The current-page layout still works without storage.
    }
  }

  return <div className={`min-h-screen ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
    {menuOpen && <button type="button" aria-label="Cerrar menú lateral" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <aside ref={asideRef} id="menu-lateral" aria-label="Menú principal" className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface transition-[width,transform,visibility] duration-200 lg:visible lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-64"} ${menuOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
      <div className={`flex h-20 items-center gap-3 border-b border-border px-6 ${collapsed ? "lg:justify-center lg:px-3" : ""}`}>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text ${collapsed ? "lg:hidden" : ""}`}><LayoutDashboard size={20} /></span>
        <span className={`whitespace-nowrap text-lg font-bold tracking-tight ${collapsed ? "lg:hidden" : ""}`}>Panel Admin</span>
        <button type="button" aria-label="Cerrar menú" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} className="ml-auto rounded-lg p-1 text-muted lg:hidden"><X size={20} /></button>
        <button type="button" aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-controls="navegacion-lateral" aria-pressed={collapsed} title={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} onClick={toggleCollapsed} className={`hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground lg:inline-flex ${collapsed ? "" : "ml-auto"}`}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
      </div>
      <nav id="navegacion-lateral" className="px-3 py-6" aria-label="Navegación principal">
        <p className={`mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted ${collapsed ? "lg:hidden" : ""}`}>Principal</p>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-label={label} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}><Icon size={19} strokeWidth={active ? 2.3 : 1.9} /><span className={collapsed ? "lg:hidden" : ""}>{label}</span></Link>;
        })}
      </nav>
      <div className={`absolute inset-x-5 bottom-6 rounded-xl border border-border bg-surface-muted px-4 py-3 ${collapsed ? "lg:hidden" : ""}`}><p className="text-xs font-semibold">Entorno de demostración</p><p className="mt-1 text-xs leading-5 text-muted">Los datos de este panel son ficticios.</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><button ref={menuButtonRef} type="button" aria-label="Abrir menú" aria-controls="menu-lateral" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-foreground lg:hidden"><Menu size={20} /></button><div className="min-w-0"><p className="truncate text-sm font-semibold">Panel de administración</p><p className="hidden text-xs text-muted sm:block">Espacio de trabajo</p></div></div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3"><FullscreenToggle /><ThemeToggle /><div className="mx-1 hidden h-8 w-px bg-border sm:block" /><div className="flex items-center gap-2.5"><Avatar name={demoAdmin.name} /><div className="hidden min-[560px]:block"><p className="text-sm font-semibold leading-5">{demoAdmin.name}</p><p className="text-xs text-muted">{demoAdmin.role}</p></div></div></div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9">{children}</main>
    </div>
  </div>;
}
