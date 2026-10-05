import { NextResponse } from "next/server";
import { clearLoginFailures, createSession, getDatabase, loginBlocked, readState, recordLoginFailure, sessionCookie, sessionMaxAge, verifyCredential } from "@/lib/server/database";
import { scopedState, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Solicitud inválida." }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const input = body as { email?: unknown; password?: unknown };
  if (typeof input?.email !== "string" || typeof input.password !== "string" || input.email.length > 254 || input.password.length > 256) return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
  const email = input.email.trim().toLowerCase();
  const db = getDatabase();
  if (loginBlocked(email, db)) return NextResponse.json({ error: "Demasiados intentos. Vuelve a intentarlo en 15 minutos." }, { status: 429 });
  const state = readState(db);
  const user = state.users.find((item) => item.email.toLowerCase() === email);
  const valid = user ? verifyCredential(user.id, input.password, db) : false;
  const membership = user && valid ? state.memberships.find((item) => item.userId === user.id && item.status === "Activo") : undefined;
  if (!user || !membership) { recordLoginFailure(email, db); return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 }); }
  clearLoginFailures(email, db);
  const token = createSession(user.id, membership.organizationId, db);
  const response = NextResponse.json({ state: scopedState(state, { userId: user.id, organizationId: membership.organizationId }) });
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: new URL(process.env.PANEL_ADMIN_ORIGIN ?? request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: sessionMaxAge });
  return response;
}
