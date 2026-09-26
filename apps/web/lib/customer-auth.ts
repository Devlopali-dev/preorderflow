// Cookie distinct de la session admin (poflow_token) — un client et un
// admin peuvent être connectés en même temps dans le même navigateur sans
// se marcher dessus. Même compromis non-httpOnly que côté admin (cf.
// lib/auth.ts) : les pages "mon-compte" appellent l'API directement
// depuis le navigateur pour les actions (modifier profil, etc.).
export const CUSTOMER_AUTH_COOKIE_NAME = "poflow_customer_token";

export function getClientCustomerToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CUSTOMER_AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getClientCustomerAuthHeaders(): Record<string, string> {
  const token = getClientCustomerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
