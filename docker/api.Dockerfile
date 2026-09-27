# syntax=docker/dockerfile:1
# pnpm épinglé sur la version du host (11.3.0) : le target `dev` bind-monte
# les node_modules du host par-dessus ceux du conteneur (hot reload), et
# des versions pnpm différentes calculent des hash de peer-deps différents
# — les symlinks du host pointent alors vers des chemins absents côté
# conteneur (MODULE_NOT_FOUND sur les binaires comme `nest`).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
# pnpm sans TTY (build Docker) refuse de toucher à node_modules sans
# confirmation explicite — CI=true la saute, comme en CI GitHub Actions.
ENV CI=true
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# Alpine récent (3.21+, base de node:22-alpine) a retiré OpenSSL 1.1 ; la
# détection auto de Prisma se trompe quand même et charge le moteur
# openssl-1.1.x au démarrage ("Error loading shared library libssl.so.1.1").
# Le moteur openssl-3.0.x existe bien (binaryTargets du schema, généré par
# `prisma generate` juste avant) — on force juste son usage au runtime,
# jamais pendant generate (le fichier n'existe pas encore à ce moment-là).
# Chemin déterministe (versions prisma/@prisma-client épinglées dans
# apps/api/package.json, pas un hash pnpm) mais spécifique arm64 (host de
# dev habituel) ; sur x86_64 utiliser libquery_engine-linux-musl-openssl-3.0.x.so.node.
ARG PRISMA_ENGINE_PATH=/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node

FROM deps AS dev
COPY . .
RUN pnpm --filter @preorderflow/database generate
ARG PRISMA_ENGINE_PATH
ENV PRISMA_QUERY_ENGINE_LIBRARY=${PRISMA_ENGINE_PATH}
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter @preorderflow/database generate
RUN pnpm --filter api build

FROM base AS runner
ARG PRISMA_ENGINE_PATH
ENV NODE_ENV=production
ENV PRISMA_QUERY_ENGINE_LIBRARY=${PRISMA_ENGINE_PATH}
COPY --from=build /app /app
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start:prod"]
