import { NextRequest, NextResponse } from "next/server";
import { forwardedForHeader } from "@/lib/forwarded-ip";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // L'API limite le débit par IP : on lui transmet celle du visiteur, pas celle du serveur web.
      ...forwardedForHeader(request.headers),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json({ user: data.user });
  // Pas httpOnly : cf. lib/auth.ts. Secure hors dev, SameSite=Lax.
  response.cookies.set(AUTH_COOKIE_NAME, data.accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 jour, aligné sur JWT_EXPIRES_IN par défaut
  });
  return response;
}
