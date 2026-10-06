import { NextResponse } from "next/server";
import { readState } from "@/lib/server/database";

export const runtime = "nodejs";
export async function GET() {
  const org = (await readState()).organizations[0];
  return NextResponse.json({ name: org.name, logoLight: org.logoLight ?? null, logoDark: org.logoDark ?? null }, { headers: { "Cache-Control": "no-store" } });
}
