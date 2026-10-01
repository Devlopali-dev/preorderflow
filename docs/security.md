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
- Un jeton admin ne suffit pas : à chaque requête, le garde global vérifie en base que le compte existe et est actif, et prend le **rôle en base**, pas celui du jeton. Un admin supprimé, désactivé ou rétrogradé perd donc ses droits immédiatement, sans attendre l'expiration du jeton (401 « Session invalide »). Côté web, un 401 renvoie vers `/login` et efface le cookie périmé (`/api/auth/session-expired`).
- Client : magic link à usage unique et expiration courte (`MAGIC_LINK_EXPIRES_IN`).
- Premier lancement : `GET /auth/setup-status` (`{ needsSetup }`, public) et `POST /auth/setup`
  (public, même throttle que `/login`) permettent de créer le tout premier compte `ADMIN` tant
  qu'aucun `AdminUser` n'existe en base. `/setup` se ferme définitivement dès la création du
  premier admin (`needsSetup` passe à `false`, l'endpoint renvoie alors `409 Conflict`). Le
  middleware web (`middleware.ts`) redirige vers `/setup` plutôt que `/login` tant que
  `needsSetup` est vrai, pour éviter une page de connexion sans identifiants possibles.

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

## Routes publiques et administrateur reconnu

Une route `@Public()` n'exige pas de jeton, mais `JwtAuthGuard` reconnaît un administrateur quand il en
fournit un valide (jeton admin, compte actif vérifié en base) : `request.user` est alors renseigné. Un jeton
absent, invalide, expiré ou d'un client laisse la requête **anonyme**, sans erreur. C'est ce qui permet de
cacher les campagnes en brouillon au public tout en laissant un administrateur les prévisualiser (404 pour un
visiteur, jamais 403 : on ne confirme pas l'existence).
