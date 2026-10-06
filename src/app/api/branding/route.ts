import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
export async function GET() {
  const org = await (await getDatabase()).organization.findFirst({ orderBy: { sortOrder: "asc" }, select: { name: true, logoLight: true, logoDark: true } });
  return NextResponse.json({ name: org?.name ?? "Panel Admin", logoLight: org?.logoLight ?? null, logoDark: org?.logoDark ?? null }, { headers: { "Cache-Control": "no-store" } });
}
