// app/api/auth/clear-cookie/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // set cookies with maxAge 0 to clear
  res.cookies.set("sb-access-token", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("sb-refresh-token", "", { httpOnly: true, path: "/", maxAge: 0 });

  return res;
}
