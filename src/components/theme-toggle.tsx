"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useDemo } from "@/components/demo-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { state, service } = useDemo();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { const preference = state.preferences[`${state.accountId}:${state.organizationId}`]; setTheme(preference?.theme ?? "system"); }, [state.accountId, state.organizationId, state.preferences, setTheme]);
  const isDark = mounted && resolvedTheme === "dark";
  return <button type="button" onClick={async () => { const theme = isDark ? "light" : "dark"; setTheme(theme); try { await service.updatePreferences(state.organizationId, { theme }); } catch { setTheme(isDark ? "dark" : "light"); } }} aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"} title={isDark ? "Modo claro" : "Modo oscuro"} className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
