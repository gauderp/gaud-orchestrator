# Gaud Orchestrator

AI agent orchestrator for development teams. Manage backlog, generate specs via multi-agent conversations, execute tasks in parallel, and track costs — all from a web dashboard.

## Features

- **Agents** — Configure AI agents with any LLM provider (Claude, OpenAI, Gemini, DeepSeek, Cursor)
- **Skills** — Create and assign reusable knowledge/instructions to agents
- **Kanban Boards** — Customizable columns with agent actions, drag-and-drop, Gantt view
- **Conversations** — Multi-agent collaborative conversations per card
- **Spec Driven Development** — Agents analyze codebase, generate specs, review workflow
- **Executions** — Parallel agent execution with dependency scheduling, PR creation
- **Memory** — Long-term agent memory with semantic search, error learning
- **Cost Tracking** — Per-agent, per-execution cost monitoring with hard limits

## Quick Start

### Development

```bash
pnpm install
pnpm dev          # API on :3001, Frontend on :5173
```

### Docker

```bash
docker compose up --build
# Open http://localhost:3001
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `data/orchestrator.db` | SQLite database path |
| `AGENTS_DIR` | `agents/` | Agent definition files (.md) |
| `ATTACHMENTS_DIR` | `data/attachments/` | Card file attachments |
| `PORT` | `3001` | API server port |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `NODE_ENV` | `development` | Set to `production` to serve frontend from API |

## Architecture

```
packages/
├── web/          React 19 + Vite + Tailwind CSS
├── api/          Fastify + SQLite + WebSocket
├── providers/    LLM provider interface + implementations
└── shared/       TypeScript types + constants
```

## Supported Providers

| Provider | Type | Streaming |
|----------|------|:---------:|
| Claude Code CLI | CLI | Yes |
| Claude API (Anthropic) | API | SSE |
| OpenAI (GPT-4o, etc.) | API | SSE |
| DeepSeek | API | SSE |
| Google Gemini | API | SSE |
| Cursor IDE | CLI | Yes |

## License

MIT
