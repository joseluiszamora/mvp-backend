import "server-only";

import { createHash } from "node:crypto";
import { DemoError } from "@/lib/demo";
import { matchesFileSignature } from "@/lib/file-signature";

export const maxFileBytes = 5 * 1024 * 1024;
export const maxMultipartBytes = maxFileBytes + 20_000;
const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);

export async function boundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new DemoError("VALIDATION", "Solicitud vacía.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxMultipartBytes) { await reader.cancel(); throw new DemoError("VALIDATION", "El archivo supera 5 MB."); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") ?? "" }, body }).formData();
}

export async function inspectUpload(file: File): Promise<{ name: string; mimeType: string; bytes: Uint8Array; checksum: string }> {
  const name = file.name.trim();
  if (!name || name.length > 180 || /[\x00-\x1f\x7f\/\\]/.test(name)) throw new DemoError("VALIDATION", "Nombre de archivo inválido.");
  if (file.size < 1 || file.size > maxFileBytes || !allowed.has(file.type)) throw new DemoError("VALIDATION", "Selecciona PDF, PNG, JPEG, WebP o texto de hasta 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(file.type, bytes)) throw new DemoError("VALIDATION", "El contenido no coincide con el tipo de archivo.");
  return { name, mimeType: file.type, bytes, checksum: createHash("sha256").update(bytes).digest("hex") };
}
