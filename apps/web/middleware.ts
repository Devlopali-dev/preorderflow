import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

// Vérifie seulement la présence du cookie — la validité du token (signature,
// expiration, rôle) est vérifiée côté API à chaque appel (source de
// vérité). Un token expiré ici mènera à des 401 gérés par les pages, pas
// une faille de sécurité.
export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/customers/:path*",
    "/inventory/:path*",
    "/production/:path*",
    "/shipments/:path*",
  ],
};
