import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { currentSession } from "@/lib/server/panel";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  if (!session.permissions.includes("files.read") || !session.enabledModules.includes("files")) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  const { id } = await context.params;
  const db = await getDatabase();
  const file = await db.fileRecord.findFirst({ where: { id, organizationId: session.organizationId }, include: { blob: true } });
  if (!file?.blob) return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  if (createHash("sha256").update(file.blob.content).digest("hex") !== file.blob.checksum) return NextResponse.json({ error: "Falló la comprobación del archivo." }, { status: 500 });
  return new Response(new Uint8Array(file.blob.content), { headers: {
    "Content-Type": file.mimeType,
    "Content-Length": String(file.blob.content.length),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  } });
}
