FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# === Install system tools ===
FROM base AS cli-tools
RUN apk add --no-cache git curl bash openssh-client

# GitHub CLI
RUN apk add --no-cache github-cli 2>/dev/null || \
    (curl -fsSL https://github.com/cli/cli/releases/download/v2.74.0/gh_2.74.0_linux_amd64.tar.gz | tar xz -C /tmp && \
     mv /tmp/gh_*/bin/gh /usr/local/bin/gh && rm -rf /tmp/gh_*)

# Claude Code CLI (optional — for claude-cli provider)
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || true

# tsx — needed to run .ts imports from shared/providers at runtime
RUN npm install -g tsx

# === Install all dependencies ===
FROM cli-tools AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/api/package.json packages/api/
COPY packages/mcp/package.json packages/mcp/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

# === Build all packages ===
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter @gaud/web build
RUN pnpm --filter @gaud/api build
RUN pnpm --filter @gaud/mcp build

# === Production image ===
FROM cli-tools AS production
WORKDIR /app

# Copy built artifacts + all node_modules needed at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# API dist + migrations
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/src/db/migrations ./packages/api/dist/db/migrations

# Web dist (served by Fastify static in production)
COPY --from=build /app/packages/web/dist ./packages/web/dist

# Shared + providers source (imported directly by API at runtime)
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/providers/src ./packages/providers/src

# MCP server dist
COPY --from=build /app/packages/mcp/dist ./packages/mcp/dist

# Agent definitions
COPY agents/ ./agents/

# Skills (invoked by agents via Claude CLI)
COPY skills/ ./skills/

# Package manifests (needed for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/api/package.json packages/api/
COPY packages/mcp/package.json packages/mcp/

# Create data directories
RUN mkdir -p /app/data /app/data/repos /app/data/attachments

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/orchestrator.db
ENV AGENTS_DIR=/app/agents
ENV ATTACHMENTS_DIR=/app/data/attachments
ENV REPOS_DIR=/app/data/repos
EXPOSE 3001

CMD ["tsx", "packages/api/dist/index.js"]
