import { NextResponse } from "next/server";
import { readState } from "@/lib/server/database";

export const runtime = "nodejs";
export function GET() {
  const org = readState().organizations[0];
  return NextResponse.json({ name: org.name, logoLight: org.logoLight ?? null, logoDark: org.logoDark ?? null }, { headers: { "Cache-Control": "no-store" } });
}
