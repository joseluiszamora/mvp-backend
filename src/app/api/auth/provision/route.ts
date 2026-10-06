import { NextResponse } from "next/server";
import { memberFor, permissionFor } from "@/lib/demo";
import { getDatabase, readState, setCredential } from "@/lib/server/database";
import { currentSession, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { userId?: unknown; password?: unknown } | null;
  if (typeof body?.userId !== "string" || typeof body.password !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const db = await getDatabase();
  const state = await readState(db);
  state.accountId = session.userId;
  state.organizationId = session.organizationId;
  const targetMemberships = state.memberships.filter((item) => item.userId === body.userId && item.status === "Activo");
  if (!permissionFor(state, "roles.manage") || !memberFor(state, body.userId, session.organizationId) || targetMemberships.length > 1) return NextResponse.json({ error: "No tienes permiso para esta acción. Las cuentas compartidas cambian su contraseña desde Perfil." }, { status: 403 });
  try { await setCredential(body.userId, body.password, db); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo habilitar la cuenta." }, { status: 400 }); }
  return NextResponse.json({ ok: true });
}
