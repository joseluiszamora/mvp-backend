import { after, NextResponse } from "next/server";
import { DemoError } from "@/lib/demo";
import { dispatchOutbox } from "@/lib/server/notification-delivery";
import { boundedFormData, inspectUpload, maxMultipartBytes } from "@/lib/server/file-content";
import { currentSession, uploadFile, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  if (!session.permissions.includes("files.manage") || !session.enabledModules.includes("files")) return NextResponse.json({ error: "No tienes permiso para subir archivos." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return NextResponse.json({ error: "Solicitud inválida." }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > maxMultipartBytes) return NextResponse.json({ error: "El archivo supera 5 MB." }, { status: 413 });
  try {
    const form = await boundedFormData(request);
    const file = form.get("file");
    if (!(file instanceof File)) throw new DemoError("VALIDATION", "Selecciona un archivo.");
    const uploaded = await uploadFile(session, await inspectUpload(file));
    after(() => dispatchOutbox(5).catch(() => {}));
    return NextResponse.json(uploaded, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DemoError) return NextResponse.json({ error: error.message }, { status: error.code === "DENIED" ? 403 : 400 });
    return NextResponse.json({ error: "No se pudo guardar el archivo." }, { status: 500 });
  }
}
