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

const PUBLIC_PAGES = [
  "/signin",
  "/signup",
  "/auth",                  // e.g. /auth/callback or /auth/settings
  "/api/auth",              // any API auth handlers you expose
  "/api/auth/callback",
  "/api/auth/set-cookie",   // example if you set cookies server-side
];
export function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Allow obvious static and Next internals, and public pages
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check Supabase session cookies (adjust names if you use custom names)
  const access = req.cookies.get("sb-access-token")?.value;
  const refresh = req.cookies.get("sb-refresh-token")?.value;
  const hasSession = Boolean(access || refresh);

  if (!hasSession) {
    // Prevent open redirect attacks by sanitizing the requested path
    const requested = nextUrl.pathname + nextUrl.search;
    const sanitized = sanitizeNext(requested);

    const url = nextUrl.clone();
    url.pathname = "/signin";
    // URL-encode the next param
    url.searchParams.set("next", encodeURIComponent(sanitized));
    return NextResponse.redirect(url);
  }

  // session found, proceed
  return NextResponse.next();
}

function isPublicPath(pathname: string) {
  if (!pathname) return false;
  // allow exact or startsWith matches for prefixes
  if (
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return true;
  }

  // allow file extensions for static assets
  if (pathname.match(/\.(png|jpg|jpeg|svg|webp|css|js|map|ico)$/i)) {
    return true;
  }

  // allow public pages or their subpaths
  if (
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return true;
  }

  // allow OAuth callback-like paths (common pattern)
  if (pathname.includes("callback")) {
    return true;
  }

  return false;
}

// Very small sanitizer to avoid open-redirects.
// Accept only same-origin absolute paths (starting with '/'), or fallback to '/'
function sanitizeNext(nextPath: string | null): string {
  if (!nextPath) return "/";
  try {
    // If it starts with '/', keep it (strip any protocol attempts like //example.com)
    if (nextPath.startsWith("/")) {
      // drop any double-slash at start except single leading slash
      return nextPath.replace(/^\/+/, "/");
    }
    // anything else is suspicious; return root
    return "/";
  } catch {
    return "/";
  }
}



export const config = {
  matcher: [
    // protect everything except API, _next static assets and common static files
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};
