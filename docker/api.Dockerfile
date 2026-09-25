# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
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
CMD ["pnpm", "--filter", "api", "start:prod"]
