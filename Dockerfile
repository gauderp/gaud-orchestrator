FROM node:20-alpine AS base
RUN corepack enable

# === Install CLI tools needed by providers ===
FROM base AS cli-tools
RUN apk add --no-cache git curl bash
# GitHub CLI (for PR creation)
RUN apk add --no-cache github-cli || \
    (curl -fsSL https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.tar.gz | tar xz -C /tmp && \
     mv /tmp/gh_*/bin/gh /usr/local/bin/gh)
# Claude Code CLI (uses host subscription via mounted ~/.claude)
RUN npm install -g @anthropic-ai/claude-code || true

# === Dependencies ===
FROM cli-tools AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/providers/package.json packages/providers/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

# === Build ===
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter @gaud/web build
RUN pnpm --filter @gaud/api build

# === Production ===
FROM cli-tools AS production
WORKDIR /app

# Create non-root user home
RUN mkdir -p /home/node/.claude /home/node/.cursor /home/node/.config/gh && \
    chown -R 1000:1000 /home/node

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
ENV ATTACHMENTS_DIR=/app/attachments
EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
