import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/uploads",
  "/chat",
  "/rules",
  "/pivot",
  "/documents",
  "/notifications",
  "/finance",
  "/scraper",
  "/voice",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(
    request.cookies.get("access_token")?.value ||
      request.cookies.get("refresh_token")?.value
  );
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasToken) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/uploads/:path*",
    "/chat/:path*",
    "/rules/:path*",
    "/pivot/:path*",
    "/documents/:path*",
    "/notifications/:path*",
    "/finance/:path*",
    "/scraper/:path*",
    "/voice/:path*",
    "/login",
  ],
};
