import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("sb-access-token"); // Supabase stores session here by default

  const url = req.nextUrl.clone();
  if (!token && req.nextUrl.pathname === "/") {
    url.pathname = "/signin"; // redirect to signin/signup page
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"], // apply to the home page (add more paths as needed)
};
