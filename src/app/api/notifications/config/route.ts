import { NextResponse } from "next/server";
import { emailConfigured } from "@/lib/server/notification-delivery";
import { currentSession } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function GET() {
  if (!await currentSession()) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  return NextResponse.json({ emailAvailable: emailConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
