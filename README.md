# Gaud Orchestrator

AI agent orchestrator for development teams. Manage backlog, generate specs via multi-agent conversations, execute tasks in parallel, and track costs — all from a web dashboard.

## Features

- **Agents** — Configure AI agents with any LLM provider (Claude, OpenAI, Gemini, DeepSeek, Cursor). Org chart hierarchy, editable instructions, per-agent cost limits
- **Skills** — Create reusable knowledge/instructions in Markdown and assign to agents
- **Kanban Boards** — Customizable columns with agent actions per column, drag-and-drop, card hierarchy (Project > Epic > Task/Bug), Gantt chart view
- **Conversations** — Multi-agent collaborative conversations per card. Agents discuss, ask each other questions, escalate to user, produce artifacts
- **Spec Driven Development** — Agents analyze codebase and generate specs. Review workflow (draft > review > approved). Decompose approved specs into cards on the Kanban
- **Executions** — Parallel agent execution with dependency scheduling, git worktrees for isolation, automatic PR creation via `gh`
- **Memory** — Long-term agent memory with semantic vector search (embeddings). Agents learn from errors and remember past experiences
- **Cost Tracking** — Per-agent, per-execution cost monitoring with hard-stop limits
- **File Attachments** — Upload files to cards (PDF, images, audio, Markdown, code). Agents can read attachments as context

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`corepack enable`)
- **Git** configured
- **gh CLI** authenticated (`gh auth status`) — for PR creation

### Development (recommended)

```bash
git clone https://github.com/gauderp/gaud-orchestrator.git
cd gaud-orchestrator
pnpm install
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

All providers work in dev mode (CLI + API) because they use your host's binaries and authentication.

### Docker

```bash
git clone https://github.com/gauderp/gaud-orchestrator.git
cd gaud-orchestrator
docker compose up --build
```

Open http://localhost:3001

Docker mounts your host's CLI credentials (read-only), so **your existing subscriptions work inside the container**:

| Subscription | Host path mounted | What it enables |
|-------------|-------------------|-----------------|
| Claude Max ($200/mês) | `~/.claude` | Claude Code CLI provider |
| Cursor Pro ($20/mês) | `~/.cursor` | Cursor CLI provider |
| GitHub | `~/.config/gh` | PR creation via `gh` |

No API keys needed for CLI providers — they use your logged-in sessions.

> **Optional:** For API-based providers (OpenAI, Gemini, DeepSeek), configure keys via the UI (Settings > Providers) or in a `.env` file.

## Configuration

### Using Your Existing Subscriptions

The orchestrator is designed to use your **existing subscriptions** (Claude Max, Cursor Pro) instead of separate API keys. CLI providers authenticate through your logged-in sessions:

| Provider | Subscription | How it works |
|----------|-------------|-------------|
| Claude Code CLI | Claude Max ($200/mês) | Uses `~/.claude` auth — already logged in |
| Cursor | Cursor Pro ($20/mês) | Uses `~/.cursor` auth — already logged in |

**No extra API keys needed** for CLI providers. Just make sure you're logged in (`claude auth status`, Cursor IDE logged in).

### API Providers (optional)

For API-based providers, configure keys via the UI (Settings > Providers) or `.env`:

```bash
cp .env.example .env
# Edit with your keys (only if using API providers):
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
```

API providers charge per-token. CLI providers use your flat-rate subscription.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `DATABASE_PATH` | `data/orchestrator.db` | SQLite database path |
| `AGENTS_DIR` | `agents/` | Agent definition files (.md) |
| `ATTACHMENTS_DIR` | `data/attachments/` | Card file attachments directory |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (dev mode) |
| `NODE_ENV` | `development` | Set `production` to serve frontend from API |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (Claude API provider) |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `DEEPSEEK_API_KEY` | — | DeepSeek API key |

## Architecture

```
gaud-orchestrator/
├── packages/
│   ├── web/            React 19 + Vite + Tailwind CSS 4
│   ├── api/            Fastify 5 + SQLite + WebSocket
│   ├── providers/      LLM provider interface + 6 implementations
│   └── shared/         TypeScript types + constants
├── agents/             Agent definitions (.md files)
├── Dockerfile          Multi-stage production build
├── docker-compose.yml  Production deployment
├── DESIGN.md           Design system (The Mission Control Console)
└── PRODUCT.md          Product brief + brand personality
```

### Monorepo (pnpm workspaces)

| Package | Purpose | Key Tech |
|---------|---------|----------|
| `@gaud/web` | Frontend UI | React 19, Vite, Tailwind v4, Zustand, @dnd-kit, Lucide icons |
| `@gaud/api` | Backend API | Fastify 5, better-sqlite3, @fastify/websocket, @fastify/multipart |
| `@gaud/providers` | LLM adapters | Raw fetch (zero SDKs), child_process for CLI |
| `@gaud/shared` | Types + constants | TypeScript interfaces for all domain entities |

### Database

SQLite with 21 tables covering: agents, skills, boards, columns, cards (with hierarchy + dependencies), specs (with versioning + reviews), executions (with tasks + gaps + logs), conversations (with messages + participants), agent memories, providers, cost logs.

## Supported Providers

| Provider | ID | Type | Streaming | Cost Tracking |
|----------|----|------|:---------:|:-------------:|
| Claude Code CLI | `claude-cli` | CLI | stdout | Estimated |
| Claude API | `claude-api` | API | SSE | Per-token |
| OpenAI | `openai` | API | SSE | Per-token |
| DeepSeek | `deepseek` | API | SSE | Per-token |
| Google Gemini | `gemini` | API | SSE | Per-token |
| Cursor IDE | `cursor` | CLI | stdout | Subscription |

All API providers use raw `fetch()` — zero SDK dependencies.

## How It Works

### The SDD Flow

```
1. Create card on Kanban        "Implement NFS-e for Catalao"
                                    |
2. Move to "Spec" column        Agents collaborate in conversation:
                                fiscal, nfse-catalao, coder analyze
                                codebase and discuss approach
                                    |
3. Spec produced as artifact    [ARTIFACT] # NFS-e Catalao Spec...
                                    |
4. Manager reviews spec         Approve / reject / comment
                                    |
5. Move to "Approved" column    Spec decomposed into execution tasks
                                    |
6. Agents execute in parallel   Each task in a git worktree,
                                respecting dependencies
                                    |
7. PRs created automatically    gh pr create per completed task
                                    |
8. Card moves to "Done"         Cost tracked, learnings stored
```

### Agent Memory

Agents have persistent memory across conversations:
- **Error corrections** — "Last time I used versaoDados 2.04 for Catalao, it failed. Use 2.01."
- **Pattern success** — "AbrasfV2NFSeEmissor works for all ABRASF municipalities."
- **User preferences** — "Always use jose for JWT, not jsonwebtoken."
- **Code knowledge** — "The fiscal module is at src/main/java/com/gaud/gaudapi/fiscal/"

Before each agent turn, relevant memories are injected into the prompt via semantic search.

## Development

### Commands

```bash
pnpm dev              # Start API + Frontend in parallel
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # TypeScript check all packages

# Per-package
pnpm --filter @gaud/api dev        # API only
pnpm --filter @gaud/web dev        # Frontend only
pnpm --filter @gaud/api test       # API tests only
pnpm --filter @gaud/providers test  # Provider tests only
```

### Project Structure

```
packages/api/src/
├── routes/            12 route modules (1 file per domain)
│   ├── health.ts      System health
│   ├── agents.ts      Agent CRUD + hierarchy + cost
│   ├── skills.ts      Skill CRUD
│   ├── providers.ts   Provider CRUD + test connection
│   ├── boards.ts      Board + column CRUD
│   ├── cards.ts       Card CRUD + move + comments + repos + deps
│   ├── conversations.ts  Conversation CRUD + turn trigger
│   ├── specs.ts       Spec CRUD + generate + review + decompose
│   ├── executions.ts  Execution CRUD + execute + cancel + gaps
│   ├── memory.ts      Memory CRUD + semantic search
│   ├── attachments.ts File upload/download
│   └── dashboard.ts   Aggregated metrics
├── services/          9 business logic modules
│   ├── cost-tracker.ts
│   ├── column-action.ts
│   ├── prompt-builder.ts
│   ├── conversation-runner.ts
│   ├── embeddings.ts
│   ├── similarity.ts
│   ├── memory.ts (AgentMemory)
│   ├── learning-detector.ts
│   ├── spec-decomposer.ts
│   ├── git-manager.ts
│   ├── session-manager.ts
│   ├── execution-engine.ts
│   ├── file-storage.ts
│   └── provider-loader.ts
├── db/                SQLite connection + migrations
├── ws/                WebSocket broadcast
└── utils/             Helpers (case conversion)

packages/web/src/
├── pages/             18 page components
├── components/
│   ├── ui/            Button, Badge, Input, Modal, Textarea, Toast, ErrorBoundary, ThemeToggle
│   ├── layout/        Sidebar, Header, Layout
│   ├── kanban/        KanbanBoard, KanbanColumn, KanbanCard, CardTypeIcon
│   ├── cards/         CardDetail, CardComments, CardRepos, CardForm
│   ├── gantt/         GanttChart, GanttBar, GanttHeader
│   ├── conversation/  ConversationView, MessageBubble, UserQuestionBanner, ArtifactBlock, ConversationStarter
│   ├── specs/         SpecEditor, SpecReviewPanel, SpecVersions, DecomposeModal
│   ├── executions/    ExecutionStatus, ExecutionTaskList, ExecutionLogs, ExecutionGaps, ExecutionPRs
│   └── memory/        MemoryCard, MemoryList
├── store/             8 Zustand stores (app, agents, skills, providers, boards, conversations, specs, executions, memory)
├── api/               Typed API client with namespaces
└── styles/            Tailwind v4 globals with DESIGN.md tokens
```

## Design System

The UI follows the "Mission Control Console" design system defined in `DESIGN.md`:

- **Colors** — Command Blue (#2563EB) for actions, Status Green (#059669) for success, restrained palette
- **Typography** — Inter for UI, JetBrains Mono for code/logs, 14px body default
- **Theme** — Light and dark mode (Tailwind `dark:` variant)
- **Components** — All use CSS custom properties from DESIGN.md tokens
- **Icons** — Lucide React exclusively (no emojis)

## Agent Definitions

Pre-configured specialist agents in `agents/`:

| Agent | Domain |
|-------|--------|
| `gaud-fiscal` | Brazilian fiscal documents (NFS-e, NF-e, NFC-e), tax calculation |
| `gaud-nfse-belo-horizonte-mg` | NFS-e integration with Belo Horizonte (BHISS Digital) |
| `gaud-nfse-catalao-go` | NFS-e integration with Catalao/GO (Prodata/SIG, ABRASF 2.01) |
| `gaud-nfse-thema-sao-leopoldo` | NFS-e integration with Thema municipalities |
| `gaud-nfse-tributos-municipais` | NFS-e integration with Tributos Municipais provider |
| `gaud-sefaz-distribution` | SEFAZ DFe Distribution (NSU, throttling, manifestation) |
| `tributos-brasil` | Brazilian taxation legislation (2025-2026) |

## License

MIT
