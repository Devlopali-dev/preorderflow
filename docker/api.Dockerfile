# syntax=docker/dockerfile:1
# pnpm épinglé sur la version du host (11.3.0) : le target `dev` bind-monte
# les node_modules du host par-dessus ceux du conteneur (hot reload), et
# des versions pnpm différentes calculent des hash de peer-deps différents
# — les symlinks du host pointent alors vers des chemins absents côté
# conteneur (MODULE_NOT_FOUND sur les binaires comme `nest`).
FROM node:22-alpine AS base
# OpenSSL : sans lui, Prisma ne détecte pas la version de libssl sur Alpine et charge le moteur
# `openssl-1.1.x` (absent) au lieu de `openssl-3.0.x` (généré par `prisma generate`, cf. binaryTargets du
# schéma, arm64 et x86_64) : « Unable to require(``) » / « Error loading shared library » à la première
# requête base. Avec openssl, la détection est automatique et vaut pour toute architecture.
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
# pnpm sans TTY (build Docker) refuse de toucher à node_modules sans
# confirmation explicite — CI=true la saute, comme en CI GitHub Actions.
ENV CI=true
# pnpm 11 revérifie les dépendances avant chaque `pnpm run` : le build copie TOUT le workspace (`COPY . .`) alors
# que l'étape `deps` n'a installé que les paquets de cette image, donc pnpm relançait une installation complète
# (+600 paquets téléchargés) au milieu du build, lente et qui échoue dès que le réseau flanche.
ENV npm_config_verify_deps_before_run=false
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS dev
COPY . .
RUN pnpm --filter @preorderflow/database generate
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter @preorderflow/database generate
RUN pnpm --filter api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
# Les migrations Prisma s'appliquent au démarrage (`migrate deploy` : n'applique que celles qui manquent,
# sans jamais toucher aux données ni réinitialiser le schéma). Un échec arrête le conteneur, visible dans
# les logs, plutôt que de laisser une API qui répond 500 sur une base sans tables.
CMD ["sh", "-c", "pnpm --filter @preorderflow/database migrate && pnpm --filter api start:prod"]
