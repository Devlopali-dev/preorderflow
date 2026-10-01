# Développement

## Prérequis

- Node.js ≥ 20
- pnpm (`corepack enable` ou `npm i -g pnpm`)
- Docker + Docker Compose

## Installation

```bash
cp .env.example .env
pnpm install
```

## Lancer en local sans Docker (services natifs)

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev            # web + api en parallèle
# ou
pnpm dev:api
pnpm dev:web
```

Nécessite un Postgres et un Redis locaux (adapter `DATABASE_URL`/`REDIS_URL` dans `.env`).

## Lancer avec Docker (recommandé)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Le mode dev monte les sources en volume avec rechargement à chaud.

## Scripts utiles

| Commande         | Effet                               |
| ---------------- | ----------------------------------- |
| `pnpm lint`      | ESLint sur tout le monorepo         |
| `pnpm typecheck` | `tsc --noEmit` sur tout le monorepo |
| `pnpm test`      | Tests unitaires (Vitest)            |
| `pnpm test:e2e`  | Tests E2E (Playwright, app web)     |
| `pnpm db:studio` | Explorateur Prisma Studio           |

## Données de test E2E

La suite Playwright crée ses propres produits, campagnes, clients et commandes dans la base de dev, sans
les supprimer (un produit s'archive, une commande s'annule). Sans nettoyage, la base grossit à chaque passage
et les pages, puis les tests, ralentissent.

- **Automatique** : un `globalTeardown` (`apps/web/e2e/global-teardown.ts`) lance le nettoyage après chaque
  passage. `E2E_KEEP_DATA=1` le désactive, pour inspecter la base après un échec.
- **À la main** : `pnpm db:clean-e2e` (ajouter `-- --dry-run` pour une simulation qui n'efface rien).

Le script (`packages/database/prisma/clean-e2e.ts`) ne supprime que ce qu'il sait reconnaître : produits et
campagnes dont l'identifiant porte un horodatage de test, clients `@example.com` autres que les 10 clients de
démo, leurs commandes et ce qui en dépend, lots de production de test, couleurs temporaires, notifications et
audit qui s'y rapportent, actions des comptes de démo, fichiers uploadés orphelins. Le jeu de démo (seed) et les
données réelles (autres clients, leurs commandes) sont épargnés. Tout nouveau test doit donc nommer ses données
avec un horodatage (`Date.now()`) ou utiliser un email `@example.com`.

## Structure

Voir [`architecture.md`](architecture.md) pour le détail de l'arborescence et des domaines.
