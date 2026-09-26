import { NextResponse } from "next/server";
import { CUSTOMER_AUTH_COOKIE_NAME } from "@/lib/customer-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CUSTOMER_AUTH_COOKIE_NAME);
  return response;
}
