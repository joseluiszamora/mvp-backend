"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="rounded-xl border border-border bg-surface p-8"><h1 className="text-xl font-bold">No se pudo cargar esta página</h1><p className="mt-2 text-muted">Intenta de nuevo o vuelve al inicio.</p><div className="mt-4 flex gap-4"><button className="text-accent-text underline" onClick={reset}>Reintentar</button><Link href="/" className="text-accent-text underline">Ir al inicio</Link></div></div>;
}
