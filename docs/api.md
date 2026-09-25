# API

L'API REST est exposée par `apps/api` (NestJS), préfixée `/api/v1`, documentée via Swagger sur
`/api/docs` en développement.

La liste complète des endpoints prévus est dans [`architecture.md` §6](architecture.md#6-endpoints-rest-phase-1--proposition-versionnés-apiv1).

## Authentification

- **Admin** (`ADMIN`/`OPERATOR`) : email + mot de passe, session JWT. Toutes les routes admin sont
  protégées par un guard + RBAC côté backend (jamais confiance au frontend, cf. §26 CLAUDE.md).
- **Client** : magic link envoyé par email, aucun mot de passe. Le token issu du lien scope
  strictement l'accès aux données du `customerId` correspondant.

## Conventions

- Validation systématique par DTO (`class-validator`) côté NestJS, même si le frontend valide déjà
  côté Zod — la validation frontend n'est jamais une source de vérité.
- Toute route publique sensible (recensement) est rate-limitée (`@nestjs/throttler`) et protégée
  par anti-spam (honeypot + option Turnstile).
- Les webhooks (`/webhooks/stripe`, `/webhooks/shipping`) vérifient la signature avant tout
  traitement.
- Les erreurs ne doivent jamais exposer de données sensibles (cf. `docs/security.md`).
