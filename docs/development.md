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

## Structure

Voir [`architecture.md`](architecture.md) pour le détail de l'arborescence et des domaines.
