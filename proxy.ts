// proxy.ts (project root or src/)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/_next",
  "/static",
  "/assets",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

// Pages and endpoints used in auth flows that must be allowed
const PUBLIC_PAGES = [
  "/signin",
  "/signup",
  "/auth",           // e.g. /auth/callback or /auth/settings
  "/api/auth",       // any API auth handlers you expose
  "/api/auth/callback",
  "/api/auth/set-cookie", // example if you set cookies server-side
];

export function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Allow obvious static and Next internals
  if (
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.match(/\.(png|jpg|jpeg|svg|webp|css|js|map|ico)$/i)
  ) {
    return NextResponse.next();
  }

  // Allow public pages and any callback paths. We also allow any path containing 'callback'
  // because OAuth providers usually redirect to /auth/callback or similar.
  if (
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.includes("callback")
  ) {
    return NextResponse.next();
  }

  // Check Supabase session cookies
  const access = req.cookies.get("sb-access-token")?.value;
  const refresh = req.cookies.get("sb-refresh-token")?.value;
  const hasSession = Boolean(access || refresh);

  if (!hasSession) {
    // redirect to signin and keep the 'next' path so the app can return the user after login
    const url = nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // session found, proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};
