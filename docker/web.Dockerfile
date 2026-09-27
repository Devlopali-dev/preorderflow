# syntax=docker/dockerfile:1
# pnpm épinglé sur la version du host (11.3.0) : cf. api.Dockerfile pour
# la raison (target `dev` + bind mount des node_modules du host). CI=true
# saute la confirmation pnpm sur node_modules, absente sans TTY en build Docker.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
ENV CI=true
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
