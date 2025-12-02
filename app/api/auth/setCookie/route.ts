// app/api/auth/set-cookie/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { access, refresh } = body ?? {};

    if (!access || !refresh) {
      return NextResponse.json({ ok: false, message: "Missing tokens" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });

    // token lifetimes (adjust as needed)
    const accessMaxAge = 60 * 60 * 8; // 8 hours
    const refreshMaxAge = 60 * 60 * 24 * 30; // 30 days

    // set httpOnly cookies so middleware can read them on subsequent requests
    res.cookies.set("sb-access-token", access, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: accessMaxAge,
    });

    res.cookies.set("sb-refresh-token", refresh, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: refreshMaxAge,
    });

    return res;
  } catch (err) {
    console.error("set-cookie error", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
