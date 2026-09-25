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
