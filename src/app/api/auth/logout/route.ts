import { NextResponse } from "next/server";
import { revokeSession, sessionCookie } from "@/lib/server/database";
import { validOrigin } from "@/lib/server/panel";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  revokeSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
