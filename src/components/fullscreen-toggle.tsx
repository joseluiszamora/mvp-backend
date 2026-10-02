"use client";

import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setError("");
    };
    setSupported(Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen));
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    setError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("El navegador no permitió cambiar a pantalla completa.");
    }
  }

  const label = isFullscreen ? "Salir de pantalla completa" : "Activar pantalla completa";
  return <div className="relative">
    <button type="button" onClick={toggleFullscreen} disabled={!supported} aria-label={supported ? label : "Pantalla completa no disponible"} aria-pressed={isFullscreen} title={supported ? label : "Pantalla completa no disponible en este navegador"} className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">{isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
    {error && <span role="status" className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-border bg-surface p-3 text-xs text-foreground shadow-lg">{error}</span>}
  </div>;
}
