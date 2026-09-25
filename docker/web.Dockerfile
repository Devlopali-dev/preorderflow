# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
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
