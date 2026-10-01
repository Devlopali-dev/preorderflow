// IP du visiteur, à transmettre à l'API quand le serveur Next appelle celle-ci à sa place (rendu
// serveur, routes /api/auth/login, /api/customer-auth/verify…). Sans cela, l'API ne verrait que
// l'adresse du serveur web : tous les visiteurs partageraient la même limite de débit (et les
// pages publiques consommeraient la limite globale du site entier).
//
// On retransmet tel quel `X-Forwarded-For` reçu du reverse proxy (Traefik), sans y ajouter l'adresse
// du serveur web : avec `TRUST_PROXY=1` côté API, l'IP retenue est la dernière du chemin, celle que
// le proxy a ajoutée, jamais une valeur falsifiée en tête d'en-tête.
export function forwardedForHeader(
  incoming: Headers | { get(name: string): string | null },
): Record<string, string> {
  const value = incoming.get("x-forwarded-for");
  return value ? { "X-Forwarded-For": value } : {};
}
