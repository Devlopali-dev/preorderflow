# Modèle de données

Source de vérité : [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).
Voir [`architecture.md`](architecture.md) pour la vue d'ensemble des relations et des décisions
d'architecture (Shipment 1-1, Interest→Customer obligatoire, stock calculé, etc.).

## Conventions

- Toutes les clés primaires sont des UUID (`@default(uuid())`).
- Tous les timestamps sont stockés en UTC (paramètre `TZ=UTC` dans `.env`).
- Les montants sont des `Decimal(10,2)` — jamais de `Float` pour de l'argent.
- Les enums de statut n'utilisent pas d'accents en base (`COMMANDES_FERMEES`, pas
  `COMMANDES_FERMÉES`) ; l'accentuation est gérée à l'affichage (i18n front).
- Aucune donnée dérivable n'est stockée : le stock (`InventoryMovement`), les statistiques de
  campagne et les totaux dépendants sont toujours calculés, jamais persistés en doublon.

## Configuration admin (`AppSettings`)

Table singleton (une seule ligne, id fixe `"singleton"`) portant l'identité de l'atelier
(`businessName`, `contactEmail`) et la configuration email/ntfy éditable depuis `/settings` :
provider email, clé Resend, host/port/secure/user/password SMTP, adresse expéditeur, url/topic/auth
ntfy. La config email/ntfy prime sur `.env` (bootstrap par défaut si la ligne n'existe pas) ;
`businessName`/`contactEmail` n'ont pas d'équivalent `.env`. Les secrets ne sont pas chiffrés —
protégés par le RBAC `ADMIN` en écriture et jamais renvoyés en lecture par l'API (voir
`docs/security.md`).

## Templates de notification (`NotificationTemplateOverride`)

Une ligne par valeur de `NotificationTemplate` personnalisée depuis `/settings` (id = le template
lui-même). Sujet et corps HTML en `{{placeholder}}`, substitués par regex au moment de l'envoi
(`renderTemplate()`). Absence de ligne = le template par défaut codé en dur dans
`notification-templates.ts` s'applique — aucune valeur "vide" à distinguer d'un défaut.

## Fichiers uploadés

`Product.imageUrl`/`Product.documentUrl` (`String?`) : URL relative (`/uploads/products/xxx.jpg`)
pour la photo (upload réel via `multer`, cf. `docs/architecture.md` §8) ou une URL externe pour le
PDF de présentation. Même schéma pour `Campaign.imageUrl`/`Campaign.documentUrl`
(`/uploads/campaigns/xxx.jpg`). Aucune infra de stockage objet (S3...) dans ce projet.

## Migrations

```bash
pnpm --filter @preorderflow/database migrate:dev   # développement, crée une migration
pnpm --filter @preorderflow/database migrate        # applique les migrations (CI/prod)
pnpm --filter @preorderflow/database studio          # explorateur de données
```

Ne jamais modifier le schéma de production directement en SQL : toute évolution passe par une
migration Prisma versionnée dans `packages/database/prisma/migrations/`.

## Seed de développement

```bash
pnpm db:seed
```

Crée : 1 administrateur, 2 opérateurs, 3 produits, 2 campagnes, 10 clients, 20 intérêts de
recensement, 10 commandes, 1 lot de production (100 unités), et 5 expéditions. Voir
[`packages/database/prisma/seed.ts`](../packages/database/prisma/seed.ts).

Identifiants de démo : `admin@preorderflow.dev` / `password123` (à changer avant toute mise en
production réelle).
