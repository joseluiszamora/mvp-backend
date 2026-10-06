import { NextResponse } from "next/server";
import { memberFor } from "@/lib/demo";
import { readState, sessionCookie, setSessionOrganization } from "@/lib/server/database";
import { currentSession, scopedState, validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { organizationId?: unknown } | null;
  const organizationId = body?.organizationId;
  const state = await readState();
  if (typeof organizationId !== "string" || memberFor(state, session.userId, organizationId)?.status !== "Activo") return NextResponse.json({ error: "Empresa no autorizada." }, { status: 403 });
  const token = (await import("next/headers")).cookies().then((store) => store.get(sessionCookie)?.value);
  const value = await token;
  if (!value) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  await setSessionOrganization(value, organizationId);
  return NextResponse.json({ state: scopedState(state, { userId: session.userId, organizationId }) });
}
