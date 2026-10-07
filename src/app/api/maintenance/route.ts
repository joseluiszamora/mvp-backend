import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { maintainAudit } from "@/lib/server/audit-integrity";
import { getDatabase, lockPanel } from "@/lib/server/database";
import { dispatchOutbox } from "@/lib/server/notification-delivery";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const expected = process.env.PANEL_MAINTENANCE_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expectedBytes = Buffer.from(expected ?? "");
  const suppliedBytes = Buffer.from(supplied);
  if (!expected || expected.includes("REEMPLAZAR") || expectedBytes.length < 32 || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const db = await getDatabase();
  const { purged, deliveriesPurged } = await db.$transaction(async (tx) => {
    await lockPanel(tx);
    const purged = await maintainAudit(tx);
    const old = await tx.emailOutbox.deleteMany({ where: { status: { in: ["sent", "failed"] }, createdAt: { lt: BigInt(Date.now() - 30 * 86_400_000) } } });
    return { purged, deliveriesPurged: old.count };
  }, { maxWait: 10_000, timeout: 120_000 });
  const processed = await dispatchOutbox(20);
  return NextResponse.json({ purged, deliveriesPurged, processed }, { headers: { "Cache-Control": "no-store" } });
}
