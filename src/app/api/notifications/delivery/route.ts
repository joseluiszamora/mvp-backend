import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { currentSession } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  if (!session.permissions.includes("settings.manage")) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  const rows = await (await getDatabase()).emailOutbox.groupBy({ by: ["status"], where: { organizationId: session.organizationId }, _count: { id: true } });
  return NextResponse.json({ counts: Object.fromEntries(rows.map((row) => [row.status, row._count.id])) }, { headers: { "Cache-Control": "no-store" } });
}
