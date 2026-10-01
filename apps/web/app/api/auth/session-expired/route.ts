import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

// Session admin invalide (compte supprimé ou désactivé, base réinitialisée,
// jeton expiré) : l'API a répondu 401. On efface le cookie périmé et on renvoie
// vers la connexion — sans quoi le middleware, qui ne regarde que la présence
// du cookie, laisserait l'utilisateur sur des pages qui ne peuvent plus rien
// charger. Les Server Components ne peuvent pas supprimer un cookie : il faut
// passer par un route handler.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?expired=1", request.url));
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
