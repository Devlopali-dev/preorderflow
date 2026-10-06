# syntax=docker/dockerfile:1
# pnpm épinglé sur la version du host (11.3.0) : le target `dev` bind-monte
# les node_modules du host par-dessus ceux du conteneur (hot reload), et
# des versions pnpm différentes calculent des hash de peer-deps différents
# — les symlinks du host pointent alors vers des chemins absents côté
# conteneur (MODULE_NOT_FOUND sur les binaires comme `nest`).
FROM node:26-alpine AS base
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

# Image de production : uniquement ce dont l'API a besoin pour tourner, pas tout le workspace (sources, dépendances
# de développement, outils de test et de build, soit plus de 2 Go).
#
# Les paquets du dépôt (@preorderflow/database et types) sont consommés EN TYPESCRIPT par l'API compilée
# (`main: src/index.ts`) : on garde la disposition du workspace (liens vers packages/…) au lieu d'un `pnpm deploy`,
# qui les copierait sous node_modules où Node refuse de lire du TypeScript.
FROM base AS runner
ENV NODE_ENV=production
# Les manifestes de TOUS les projets du workspace, pour que le lockfile reste valable (`--frozen-lockfile`).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
# Dépendances de PRODUCTION de l'API seulement. --ignore-scripts : le `prepare` (husky) de la racine n'existe pas
# sans les dépendances de développement ; le client Prisma est généré explicitement plus bas.
# Le magasin et le cache de pnpm (plus de 500 Mo) sont des MONTAGES DE CACHE BuildKit : ils servent à la construction
# mais n'entrent jamais dans l'image (un `rm` dans une couche suivante ne l'aurait pas réduite), et accélèrent les
# reconstructions.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm \
    --mount=type=cache,id=pnpm-meta,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter "api..."
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/database packages/database
COPY --from=build /app/packages/types packages/types
# Client Prisma pour CETTE installation. Le CLI `prisma` est une dépendance de production (migrations au démarrage) :
# /root/.cache/prisma, où il télécharge son moteur de migration, reste dans l'image.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm \
    --mount=type=cache,id=pnpm-meta,target=/root/.cache/pnpm \
    pnpm --filter @preorderflow/database generate
EXPOSE 3001
# Les migrations Prisma s'appliquent au démarrage (`migrate deploy` : n'applique que celles qui manquent, sans jamais
# toucher aux données ni réinitialiser le schéma). Un échec arrête le conteneur, visible dans les logs, plutôt que de
# laisser une API qui répond 500 sur une base sans tables. Le binaire Prisma est appelé directement (pas de pnpm au
# démarrage : son magasin a été retiré) ; `exec` : Node devient le processus principal et reçoit SIGTERM (arrêt propre).
CMD ["sh", "-c", "cd packages/database && ./node_modules/.bin/prisma migrate deploy && cd ../.. && exec node apps/api/dist/main.js"]
