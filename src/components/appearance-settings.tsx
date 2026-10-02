"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, PageHeading } from "@/components/ui";
import { accentChoices, accentStorageKey, isAccentColor, type AccentColor, type AppearanceMode } from "@/lib/appearance";

type Preferences = Record<AppearanceMode, AccentColor>;
const defaultPreferences: Preferences = { light: "blue", dark: "blue" };

export function AppearanceSettings() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  useEffect(() => {
    const saved: Preferences = { ...defaultPreferences };
    for (const mode of ["light", "dark"] as const) {
      try {
        const value = window.localStorage.getItem(accentStorageKey(mode));
        if (isAccentColor(value)) saved[mode] = value;
      } catch {
        // The palette remains usable when browser storage is unavailable.
      }
    }
    setPreferences(saved);
  }, []);

  function chooseColor(mode: AppearanceMode, color: AccentColor) {
    setPreferences((current) => ({ ...current, [mode]: color }));
    document.documentElement.setAttribute(`data-accent-${mode}`, color);
    try { window.localStorage.setItem(accentStorageKey(mode), color); } catch {
      // The current-page selection still works without storage.
    }
  }

  return <>
    <PageHeading eyebrow="Personalización" title="Configuración" description="Elige un color de acento para cada apariencia del panel." aside={<span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted">Preferencias de este navegador</span>} />
    <div className="grid gap-6">
      {(["light", "dark"] as const).map((mode) => {
        const isDark = mode === "dark";
        const selected = accentChoices.find((choice) => choice.id === preferences[mode]) ?? accentChoices[0];
        const previewColor = isDark ? selected.dark : selected.light;
        return <Card key={mode} className="overflow-hidden">
          <div className="flex items-start gap-3 border-b border-border px-5 py-5 sm:px-6"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Palette size={20} /></span><div><h2 className="font-bold">Modo {isDark ? "oscuro" : "claro"}</h2><p className="mt-1 text-sm leading-6 text-muted">Color de los enlaces, indicadores y controles en el tema {isDark ? "oscuro" : "claro"}.</p></div></div>
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start sm:p-6"><fieldset><legend className="mb-3 text-sm font-semibold">Color de acento para modo {isDark ? "oscuro" : "claro"}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{accentChoices.map((choice) => {
            const active = preferences[mode] === choice.id;
            return <button key={choice.id} type="button" aria-pressed={active} aria-label={`${choice.name} para modo ${isDark ? "oscuro" : "claro"}`} onClick={() => chooseColor(mode, choice.id)} style={active ? { borderColor: isDark ? choice.dark : choice.light } : undefined} className={`flex min-h-20 flex-col items-start justify-between rounded-xl border p-3 text-left transition hover:bg-surface-muted ${active ? "bg-surface-muted" : "border-border bg-surface"}`}><span className="flex size-7 items-center justify-center rounded-full" style={{ backgroundColor: isDark ? choice.dark : choice.light }}>{active && <Check size={16} strokeWidth={3} className={isDark ? "text-slate-950" : "text-white"} />}</span><span className="text-sm font-semibold">{choice.name}</span></button>;
          })}</div></fieldset>
          <div className={`rounded-xl border p-4 ${isDark ? "border-slate-700 bg-[#151f2e] text-[#eef3fb]" : "border-slate-200 bg-white text-[#172033]"}`} aria-label={`Vista previa del modo ${isDark ? "oscuro" : "claro"}`}><p className={`text-xs font-semibold ${isDark ? "text-[#a6b4ca]" : "text-[#667085]"}`}>Vista previa</p><div className="mt-4 flex items-center gap-3"><span className="size-9 rounded-lg" style={{ backgroundColor: previewColor }} /><div><p className="text-sm font-semibold">Panel Admin</p><p className="text-xs" style={{ color: previewColor }}>{selected.name} seleccionado</p></div></div><div className={`mt-4 h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-100"}`}><div className="h-full w-2/3 rounded-full" style={{ backgroundColor: previewColor }} /></div></div></div>
        </Card>;
      })}
    </div>
    <p className="mt-5 text-sm leading-6 text-muted">Los cambios se aplican al instante y se conservan en este navegador. Usa el botón de la cabecera para cambiar entre los modos claro y oscuro.</p>
  </>;
}
