import { NextRequest, NextResponse } from "next/server";
import { forwardedForHeader } from "@/lib/forwarded-ip";
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
    return redirectToLoginOrSetup(request, pathname);
  }
  return NextResponse.next();
}

// Premier lancement (aucun AdminUser en base) : renvoyer vers /login serait
// une impasse (aucun identifiant ne fonctionnera jamais) — on vérifie donc
// /auth/setup-status avant de choisir la destination. Si l'appel échoue
// (API indisponible), on retombe sur /login, comportement inchangé.
async function redirectToLoginOrSetup(request: NextRequest, pathname: string) {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/setup-status`, {
      cache: "no-store",
      headers: forwardedForHeader(request.headers),
    });
    const { needsSetup } = await res.json();
    if (needsSetup) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  } catch {
    // API indisponible — on tente quand même /login ci-dessous.
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    // Exact ("/campaigns" seul, sans :path*) : /campaigns/:slug reste la
    // page publique de recensement (§19), jamais derrière l'auth admin.
    "/campaigns",
    "/orders/:path*",
    "/customers/:path*",
    "/inventory/:path*",
    "/production/:path*",
    "/shipments/:path*",
    "/settings/:path*",
    "/mon-compte/:path*",
  ],
};
