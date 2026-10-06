import { NextResponse } from "next/server";
import { DemoError } from "@/lib/demo";
import { currentSession, runOperation, snapshot, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  return NextResponse.json({ state: await snapshot(session) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Solicitud inválida." }, { status: 415 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { method?: unknown; args?: unknown } | null;
  if (typeof body?.method !== "string" || !Array.isArray(body.args)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    const result = await runOperation(session, body.method, body.args);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DemoError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "DENIED" ? 403 : error.code === "NOT_FOUND" ? 404 : 400 });
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
