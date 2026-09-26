// Cookie non-httpOnly volontaire : les composants client (payment-panel,
// fulfillment-panel) appellent l'API NestJS directement depuis le
// navigateur et doivent pouvoir lire le token pour poser l'en-tête
// Authorization. Compromis raisonnable pour un outil d'administration
// interne (équivalent en sécurité à un token en localStorage) — jamais
// utilisé pour l'espace client final, qui n'existe pas encore (§20,
// magic link, à traiter séparément).
export const AUTH_COOKIE_NAME = "poflow_token";

export function getClientToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getClientAuthHeaders(): Record<string, string> {
  const token = getClientToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
