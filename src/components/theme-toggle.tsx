"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"} title={isDark ? "Modo claro" : "Modo oscuro"} className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
