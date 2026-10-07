"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDemo } from "@/components/demo-provider";
import { Card, PageHeading } from "@/components/ui";
import { type FileRecord, permissionFor } from "@/lib/demo";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground";
export function FilesSection() {
  const { state, service, refresh } = useDemo();
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query);
  const [fileType, setFileType] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const org = state.organizationId;
  const canManage = permissionFor(state, "files.manage");
  const types = [...new Set(state.files.filter((item) => item.organizationId === org).map((item) => item.mimeType))];
  useEffect(() => { let active = true; setLoading(true); service.listFiles(org, { search, mimeType: fileType || undefined, pageSize: 100 }).then((result) => { if (active) { setRecords(result.items); setError(""); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los archivos."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [service, org, search, fileType, state.files, state.scenario]);
  async function add(file?: File) { if (!file) return; setUploading(true); try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/files", { method: "POST", body: form, credentials: "same-origin" }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "No se pudo subir el archivo."); await refresh(); setMessage("Archivo guardado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo subir el archivo."); } finally { setUploading(false); } }
  async function rename(record: FileRecord) { const name = window.prompt("Nuevo nombre", record.name); if (!name) return; try { await service.renameFile(org, record.id, name); setMessage("Archivo renombrado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo renombrar."); } }
  async function remove(record: FileRecord) { if (!window.confirm(`¿Eliminar ${record.name}?`)) return; try { await service.deleteFile(org, record.id); setMessage("Registro eliminado."); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar."); } }
  return <><PageHeading eyebrow="Recursos" title="Archivos" description="Archivos privados de la empresa y muestras iniciales." />{message && <p role="status" className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-text">{message}</p>}{error && <p role="alert" className="mb-4 rounded-lg bg-surface-muted p-3 text-sm">{error}</p>}<Card className="p-5"><div className="flex flex-wrap gap-3"><label className="min-w-40 flex-1 text-sm">Buscar<input className={field} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre" /></label><label className="min-w-40 flex-1 text-sm">Tipo<select className={field} value={fileType} onChange={(event) => setFileType(event.target.value)}><option value="">Todos</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>{canManage && <label className="min-w-40 flex-1 text-sm">Subir archivo<input className={field} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" disabled={uploading} onChange={(event) => { void add(event.target.files?.[0]); event.target.value = ""; }} /></label>}</div>{loading ? <p role="status" className="py-10 text-center text-muted">Cargando archivos…</p> : error ? null : records.length === 0 ? <p className="py-10 text-center text-muted">No hay archivos.</p> : <ul className="mt-4 divide-y divide-border">{records.map((record) => <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong className="block">{record.name}</strong><small className="text-muted">{record.mimeType} · {Math.round(record.size / 1024)} KB · {state.users.find((user) => user.id === record.ownerId)?.name ?? "Cuenta"} · {new Intl.DateTimeFormat("es-BO", { timeZone: state.organizations.find((item) => item.id === org)?.timezone ?? "America/La_Paz" }).format(new Date(record.createdAt))}</small></span><span className="flex gap-3"><a className="text-accent-text underline" href={record.sampleAssetPath ?? `/api/files/${encodeURIComponent(record.id)}`} download={record.name}>Descargar</a>{canManage && <><button className="text-accent-text underline" onClick={() => rename(record)}>Renombrar</button><button className="text-accent-text underline" onClick={() => remove(record)}>Eliminar</button></>}</span></li>)}</ul>}</Card></>;
}
