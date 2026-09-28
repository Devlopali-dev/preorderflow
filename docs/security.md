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

- Export des données d'un client sur demande (`POST /customers/:id/gdpr-export`, `ADMIN`
  uniquement).
- Anonymisation/suppression indépendante des commandes historiques
  (`POST /customers/:id/gdpr-anonymize`, `ADMIN` uniquement), cf. règle §24 du cahier des charges.
- Consentement explicite (`consentToContact`) stocké sur chaque intérêt de recensement.
- Durée de conservation configurable (à définir en Phase 4/paramètres).

## Paramètres admin et secrets

- `PATCH /settings` (config email/SMTP/ntfy) et les endpoints `POST /settings/test-email` /
  `test-ntfy` sont restreints à `ADMIN` — identifiants de messagerie = donnée sensible, même
  logique que le RGPD. `test-email`/`test-ntfy` sont en plus throttlés (5/min) : ils envoient un
  vrai email/push, un compte compromis ne doit pas pouvoir servir de relai de spam.
- `GET /settings` (ouvert à tout admin authentifié) ne renvoie jamais un secret en clair — juste
  des booléens "configuré" et les champs non sensibles (host, port, utilisateur, expéditeur).
- `PATCH /settings/templates/:template` et `DELETE /settings/templates/:template` (édition des
  templates de notification) sont aussi restreints à `ADMIN` — un template altéré est un vecteur
  de phishing potentiel envers les clients. `GET /settings/templates` reste ouvert à tout admin.
- Toute action sensible (RGPD, modification des paramètres, statuts) est journalisée dans
  `AuditLog` avec l'identité de l'admin — jamais les valeurs secrètes elles-mêmes dans le journal.

## Signalement d'une vulnérabilité

Voir [`SECURITY.md`](../SECURITY.md).
