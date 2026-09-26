import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { CUSTOMER_AUTH_COOKIE_NAME } from "@/lib/customer-auth";

// Vérifie seulement la présence du cookie — la validité du token (signature,
// expiration, rôle) est vérifiée côté API à chaque appel (source de
// vérité). Un token expiré ici mènera à des 401 gérés par les pages, pas
// une faille de sécurité.
const CUSTOMER_PUBLIC_PATHS = ["/mon-compte/connexion", "/mon-compte/verifier"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/mon-compte")) {
    if (CUSTOMER_PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
      return NextResponse.next();
    }
    const customerToken = request.cookies.get(CUSTOMER_AUTH_COOKIE_NAME)?.value;
    if (!customerToken) {
      return NextResponse.redirect(new URL("/mon-compte/connexion", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
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
    "/mon-compte/:path*",
  ],
};
