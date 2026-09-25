# Sécurité

## Principes

- Toute autorisation est vérifiée côté backend (NestJS guards + RBAC), jamais côté frontend
  uniquement.
- Validation double : Zod côté client (UX), DTO `class-validator` côté serveur (source de vérité).
- Tout accès SQL passe par Prisma — aucune requête SQL brute non paramétrée.
- Secrets uniquement via variables d'environnement (`.env`, jamais commité — voir `.gitignore`).
- Logs applicatifs sans données personnelles ni secrets.

## Authentification

- Admin : mot de passe hashé (bcrypt), session JWT, cookies `httpOnly` + `secure` en production.
- Client : magic link à usage unique et expiration courte (`MAGIC_LINK_EXPIRES_IN`).

## Protections réseau

- `helmet` pour les en-têtes de sécurité HTTP.
- CORS strict, origine limitée à `CORS_ORIGIN`.
- Rate limiting global (`@nestjs/throttler`) + limite dédiée plus stricte sur le formulaire de
  recensement public.
- Anti-spam recensement : honeypot obligatoire, captcha (Turnstile) activable par variable d'env.

## RGPD

- Export des données d'un client sur demande (`POST /customers/:id/gdpr-export`).
- Anonymisation/suppression indépendante des commandes historiques
  (`POST /customers/:id/gdpr-anonymize`), cf. règle §24 du cahier des charges.
- Consentement explicite (`consentToContact`) stocké sur chaque intérêt de recensement.
- Durée de conservation configurable (à définir en Phase 4/paramètres).

## Signalement d'une vulnérabilité

Voir [`SECURITY.md`](../SECURITY.md).
