FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/providers/node_modules ./packages/providers/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY . .
RUN pnpm --filter @gaud/web build
RUN pnpm --filter @gaud/api build

FROM base AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/src/db/migrations ./packages/api/dist/db/migrations
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/providers/src ./packages/providers/src
COPY agents/ ./agents/
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/api/package.json packages/api/

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/orchestrator.db
ENV AGENTS_DIR=/app/agents
EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
