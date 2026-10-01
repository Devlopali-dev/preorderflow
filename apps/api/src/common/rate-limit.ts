import type { ThrottlerModuleOptions } from "@nestjs/throttler";

// Limites de débit (CLAUDE.md §26 : rate limiting, protection brute-force).
//
// - Limite globale par défaut : 100 requêtes par minute et par IP.
// - Les routes sensibles (login, magic link, recensement, commande publique, réglages) ont leur propre
//   limite, plus stricte, déclarée avec `@Throttle` sur la route.
// - `RATE_LIMIT_DISABLED=true` coupe tout (suite E2E, développement local) : à ne JAMAIS mettre en
//   production.
export const RATE_LIMIT_MESSAGE = "Trop de requêtes : réessayez dans une minute.";

export function rateLimitDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RATE_LIMIT_DISABLED === "true";
}

export function throttlerModuleOptions(
  env: NodeJS.ProcessEnv = process.env,
): ThrottlerModuleOptions {
  return {
    throttlers: [{ name: "default", ttl: 60_000, limit: 100 }],
    skipIf: () => rateLimitDisabled(env),
    errorMessage: RATE_LIMIT_MESSAGE,
  };
}

// Valeur de `TRUST_PROXY`, pour Express (`app.set("trust proxy", …)`).
//
// Derrière un reverse proxy (Traefik, Coolify), l'adresse de la connexion est celle du proxy : sans cette
// option, tous les visiteurs partageraient la même limite. Elle indique à Express de lire l'IP réelle
// dans `X-Forwarded-For`, en ne faisant confiance qu'aux sauts de proxy déclarés :
// - vide / `false` : aucun proxy de confiance (par défaut, accès direct : l'en-tête est ignoré, donc
//   impossible de contourner la limite en le falsifiant) ;
// - un nombre (`1`) : nombre de proxys devant l'API ;
// - une liste séparée par des virgules d'adresses, de plages CIDR ou de noms (`loopback`, `10.0.0.0/8`).
// `true` n'est volontairement pas pris tel quel (faire confiance à tout l'en-tête permettrait de le
// falsifier) : il vaut un seul proxy.
export function parseTrustProxy(value: string | undefined): boolean | number | string[] {
  const raw = value?.trim();
  if (!raw || raw.toLowerCase() === "false") return false;
  if (raw.toLowerCase() === "true") return 1;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
