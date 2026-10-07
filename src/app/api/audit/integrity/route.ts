import { NextResponse } from "next/server";
import { verifyAudit } from "@/lib/server/audit-integrity";
import { getDatabase } from "@/lib/server/database";
import { currentSession } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  if (!session.permissions.includes("audit.read") || !session.enabledModules.includes("audit")) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  return NextResponse.json(await verifyAudit(await getDatabase(), session.organizationId), { headers: { "Cache-Control": "no-store" } });
}
