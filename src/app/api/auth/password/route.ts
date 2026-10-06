import { NextResponse } from "next/server";
import { getDatabase, setCredential, verifyCredential } from "@/lib/server/database";
import { currentSession, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
  if (typeof body?.currentPassword !== "string" || typeof body.newPassword !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const db = await getDatabase();
  if (!await verifyCredential(session.userId, body.currentPassword, db)) return NextResponse.json({ error: "La contraseña actual no coincide." }, { status: 403 });
  try { await setCredential(session.userId, body.newPassword, db); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cambiar la contraseña." }, { status: 400 }); }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("panel_admin_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
