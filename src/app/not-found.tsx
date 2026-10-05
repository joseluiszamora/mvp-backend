import Link from "next/link";
export default function NotFound() { return <div className="rounded-xl border border-border bg-surface p-8"><h1 className="text-xl font-bold">Página no encontrada</h1><p className="mt-2 text-muted">La ruta solicitada no existe.</p><Link href="/" className="mt-4 inline-block text-accent-text underline">Volver al inicio</Link></div>; }
