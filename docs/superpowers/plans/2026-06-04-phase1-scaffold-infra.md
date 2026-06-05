# Gaud Orchestrator — Phase 1: Scaffold + Infra

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the gaud-orchestrator monorepo with working Fastify API (SQLite + WebSocket), React frontend (Tailwind + dark mode), shared types, layout shell, and Docker Compose — all wired up and testable.

**Architecture:** pnpm workspaces monorepo with 4 packages (web, api, providers, shared). Fastify serves the API on port 3001, Vite dev server on port 5173 proxies /api and /ws to Fastify. SQLite via better-sqlite3 for persistence. Tailwind v4 with class-based dark mode. Docker Compose for production.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Fastify 5, better-sqlite3, @fastify/websocket, Zustand 5, pnpm 9, TypeScript 5, vitest, Docker.

**Spec:** `docs/superpowers/specs/2026-06-04-gaud-orchestrator-design.md`
**Design System:** `DESIGN.md` (The Mission Control Console)
**Product Context:** `PRODUCT.md`

---

## File Structure (what this phase creates)

```
gaud-orchestrator/
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── agent.ts
│   │   │   │   ├── board.ts
│   │   │   │   ├── card.ts
│   │   │   │   ├── spec.ts
│   │   │   │   ├── execution.ts
│   │   │   │   ├── provider.ts
│   │   │   │   ├── skill.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── providers/
│   │   ├── src/
│   │   │   ├── interface.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   └── migrations/
│   │   │   │       └── 001_initial.sql
│   │   │   ├── ws/
│   │   │   │   └── broadcast.ts
│   │   │   ├── routes/
│   │   │   │   └── health.ts
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── health.test.ts
│   │   │       └── db.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── Header.tsx
│       │   │   │   └── Layout.tsx
│       │   │   └── ui/
│       │   │       ├── Button.tsx
│       │   │       └── ThemeToggle.tsx
│       │   ├── pages/
│       │   │   └── DashboardPage.tsx
│       │   ├── store/
│       │   │   └── app.ts
│       │   ├── api/
│       │   │   └── client.ts
│       │   ├── styles/
│       │   │   └── globals.css
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── __tests__/
│       │       └── app.test.tsx
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── agents/               # (copied from rufloui)
├── docker-compose.yml
├── Dockerfile
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .gitignore
```

---

## Task 1: Create GitHub Repo and Root Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create GitHub repo**

```bash
cd D:/development/ruflo
gh repo create gauderp/gaud-orchestrator --public --clone --description "AI agent orchestrator for Gaud ERP"
cd gaud-orchestrator
```

If the directory already exists with the spec (from brainstorming), init inside it:
```bash
cd D:/development/ruflo/gaud-orchestrator
gh repo create gauderp/gaud-orchestrator --public --source=. --push --description "AI agent orchestrator for Gaud ERP"
```

- [ ] **Step 2: Create root package.json**

Create `package.json`:
```json
{
  "name": "gaud-orchestrator",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "pnpm --parallel --filter @gaud/api --filter @gaud/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Create tsconfig.base.json**

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 5: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.env
.env.*
*.db
*.db-journal
.ruflo/
.DS_Store
```

- [ ] **Step 6: Create package directories**

```bash
mkdir -p packages/shared/src/types
mkdir -p packages/providers/src
mkdir -p packages/api/src/{db/migrations,ws,routes,__tests__}
mkdir -p packages/web/src/{components/{layout,ui},pages,store,api,styles,__tests__}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo root"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/agent.ts`
- Create: `packages/shared/src/types/board.ts`
- Create: `packages/shared/src/types/card.ts`
- Create: `packages/shared/src/types/spec.ts`
- Create: `packages/shared/src/types/execution.ts`
- Create: `packages/shared/src/types/provider.ts`
- Create: `packages/shared/src/types/skill.ts`
- Create: `packages/shared/src/types/conversation.ts`
- Create: `packages/shared/src/types/memory.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/shared/package.json`:
```json
{
  "name": "@gaud/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create type files**

Create `packages/shared/src/types/provider.ts`:
```typescript
export interface SpawnOpts {
  prompt: string
  cwd: string
  env?: Record<string, string>
  model?: string
}

export interface OutputEvent {
  type: 'stdout' | 'stderr' | 'approval_request' | 'cost'
  content: string
  timestamp: string
  tokens?: { input: number; output: number }
  cost?: number
}

export interface AgentSession {
  id: string
  status: 'running' | 'paused' | 'done' | 'failed'
}

export interface ProviderConfig {
  id: string
  name: string
  type: string
  configJson: Record<string, unknown>
  createdAt: string
}
```

Create `packages/shared/src/types/agent.ts`:
```typescript
export interface Agent {
  id: string
  name: string
  role: string | null
  instructions: string | null
  providerId: string | null
  model: string | null
  costLimitUsd: number
  parentAgentId: string | null
  createdAt: string
}

export interface AgentCostLog {
  id: string
  agentId: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  providerId: string | null
  model: string | null
  taskId: string | null
  createdAt: string
}

export interface AgentWithChildren extends Agent {
  children: AgentWithChildren[]
  skills: Skill[]
}

import type { Skill } from './skill.js'
```

Create `packages/shared/src/types/skill.ts`:
```typescript
export interface Skill {
  id: string
  name: string
  description: string | null
  content: string
  createdAt: string
  updatedAt: string
}
```

Create `packages/shared/src/types/board.ts`:
```typescript
export interface Board {
  id: string
  name: string
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  color: string
  position: number
  agentActionPrompt: string | null
  autoMove: boolean
  roleRequired: string | null
  createdAt: string
}

export interface BoardWithColumns extends Board {
  columns: Column[]
}
```

Create `packages/shared/src/types/card.ts`:
```typescript
export type CardType = 'project' | 'epic' | 'task' | 'bug'

export interface Card {
  id: string
  boardId: string
  columnId: string
  parentCardId: string | null
  type: CardType
  title: string
  description: string | null
  assignedAgentId: string | null
  estimatedTokens: number | null
  estimatedCostUsd: number | null
  position: number
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CardDependency {
  cardId: string
  dependsOnCardId: string
}

export interface CardWithDetails extends Card {
  repos: CardRepo[]
  comments: CardComment[]
  attachments: CardAttachment[]
  children: Card[]
  dependencies: CardDependency[]
}

export interface CardRepo {
  id: string
  cardId: string
  repoPath: string
  specPath: string | null
}

export interface CardComment {
  id: string
  cardId: string
  authorType: 'user' | 'agent'
  authorId: string | null
  content: string
  createdAt: string
}

export interface CardAttachment {
  id: string
  cardId: string
  filename: string
  path: string
  createdAt: string
}

```

Create `packages/shared/src/types/spec.ts`:
```typescript
export type SpecStatus = 'draft' | 'review' | 'approved' | 'rejected'

export interface Spec {
  id: string
  title: string
  content: string
  status: SpecStatus
  sourceCardId: string | null
  version: number
  createdByType: 'user' | 'agent'
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface SpecReview {
  id: string
  specId: string
  reviewerType: 'user' | 'agent'
  reviewerId: string | null
  verdict: 'approve' | 'reject' | 'comment'
  comment: string | null
  createdAt: string
}
```

Create `packages/shared/src/types/execution.ts`:
```typescript
export type ExecutionStatus = 'planning' | 'approving' | 'executing' | 'done' | 'failed'
export type ExecutionTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'paused'
export type GapStatus = 'pending' | 'resolved'

export interface Execution {
  id: string
  cardId: string | null
  specId: string | null
  status: ExecutionStatus
  createdAt: string
  updatedAt: string
}

export interface ExecutionTask {
  id: string
  executionId: string
  title: string
  description: string | null
  branch: string | null
  status: ExecutionTaskStatus
  agentId: string | null
  dependsOn: string | null
  prUrl: string | null
  createdAt: string
}

export interface ExecutionGap {
  id: string
  executionId: string
  question: string
  suggestion: string | null
  response: string | null
  status: GapStatus
}

export interface ExecutionLog {
  id: string
  executionTaskId: string
  content: string
  type: 'stdout' | 'stderr' | 'approval_request'
  createdAt: string
}
```

Create `packages/shared/src/types/conversation.ts`:
```typescript
export type ConversationType = 'spec' | 'plan' | 'code' | 'research' | 'review'
export type ConversationStatus = 'active' | 'paused_for_user' | 'completed'
export type MessageType = 'content' | 'question_for_agent' | 'question_for_user' | 'artifact'

export interface Conversation {
  id: string
  cardId: string | null
  type: ConversationType
  status: ConversationStatus
  summary: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationParticipant {
  conversationId: string
  agentId: string
  joinedAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderType: 'agent' | 'user' | 'system'
  senderId: string | null
  content: string
  messageType: MessageType
  mentions: string | null
  createdAt: string
}

export interface ConversationWithMessages extends Conversation {
  participants: ConversationParticipant[]
  messages: Message[]
}
```

Create `packages/shared/src/types/memory.ts`:
```typescript
export type MemoryType = 'conversation' | 'error_correction' | 'pattern_success' | 'code_knowledge' | 'user_preference'

export interface AgentMemoryEntry {
  id: string
  agentId: string
  type: MemoryType
  content: string
  metadataJson: Record<string, unknown>
  tags: string[]
  relevanceScore: number
  createdAt: string
  updatedAt: string
}

export interface MemorySession {
  id: string
  agentId: string
  conversationId: string | null
  startedAt: string
  endedAt: string | null
  consolidated: boolean
}

export interface MemoryStats {
  totalMemories: number
  byType: Record<MemoryType, number>
  byAgent: Record<string, number>
}
```

Create `packages/shared/src/types/index.ts`:
```typescript
export type * from './agent.js'
export type * from './board.js'
export type * from './card.js'
export type * from './conversation.js'
export type * from './execution.js'
export type * from './memory.js'
export type * from './provider.js'
export type * from './skill.js'
export type * from './spec.js'
```

Create `packages/shared/src/constants.ts`:
```typescript
export const CARD_TYPES = ['project', 'epic', 'task', 'bug'] as const
export const SPEC_STATUSES = ['draft', 'review', 'approved', 'rejected'] as const
export const EXECUTION_STATUSES = ['planning', 'approving', 'executing', 'done', 'failed'] as const
export const CONVERSATION_TYPES = ['spec', 'plan', 'code', 'research', 'review'] as const
export const MEMORY_TYPES = ['conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference'] as const
```

Create `packages/shared/src/index.ts`:
```typescript
export type * from './types/index.js'
export * from './constants.js'
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types package"
```

---

## Task 3: Providers Interface Package

**Files:**
- Create: `packages/providers/package.json`
- Create: `packages/providers/tsconfig.json`
- Create: `packages/providers/src/interface.ts`
- Create: `packages/providers/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/providers/package.json`:
```json
{
  "name": "@gaud/providers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gaud/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/providers/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create provider interface**

Create `packages/providers/src/interface.ts`:
```typescript
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

export interface AgentProvider {
  id: string
  name: string
  models: string[]
  spawn(opts: SpawnOpts): Promise<AgentSession>
  send(sessionId: string, message: string): Promise<void>
  kill(sessionId: string): Promise<void>
  onOutput(sessionId: string, cb: (event: OutputEvent) => void): void
  estimateCost(model: string, tokens: { input: number; output: number }): number
}

export interface ProviderRegistry {
  register(provider: AgentProvider): void
  get(id: string): AgentProvider | undefined
  list(): AgentProvider[]
}

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, AgentProvider>()
  return {
    register(provider) {
      providers.set(provider.id, provider)
    },
    get(id) {
      return providers.get(id)
    },
    list() {
      return [...providers.values()]
    },
  }
}
```

Create `packages/providers/src/index.ts`:
```typescript
export { createProviderRegistry } from './interface.js'
export type { AgentProvider, ProviderRegistry } from './interface.js'
```

- [ ] **Step 4: Commit**

```bash
git add packages/providers/
git commit -m "feat: add providers interface package"
```

---

## Task 4: API Package — Fastify + SQLite + WebSocket

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/db/connection.ts`
- Create: `packages/api/src/db/migrate.ts`
- Create: `packages/api/src/db/migrations/001_initial.sql`
- Create: `packages/api/src/ws/broadcast.ts`
- Create: `packages/api/src/routes/health.ts`
- Create: `packages/api/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/api/package.json`:
```json
{
  "name": "@gaud/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/cors": "^11.0.0",
    "@fastify/websocket": "^11.0.0",
    "@gaud/shared": "workspace:*",
    "@gaud/providers": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "fastify": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `packages/api/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 4: Create SQLite connection**

Create `packages/api/src/db/connection.ts`:
```typescript
import Database from 'better-sqlite3'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'orchestrator.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
```

- [ ] **Step 5: Create migration runner**

Create `packages/api/src/db/migrate.ts`:
```typescript
import { getDb } from './connection.js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function runMigrations(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  )

  const migrationsDir = join(__dirname, 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    console.log(`Migration applied: ${file}`)
  }
}
```

- [ ] **Step 6: Create initial migration**

Create `packages/api/src/db/migrations/001_initial.sql`:
```sql
-- Providers
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  instructions TEXT,
  provider_id TEXT REFERENCES providers(id),
  model TEXT,
  cost_limit_usd REAL DEFAULT 0,
  parent_agent_id TEXT REFERENCES agents(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_cost_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  provider_id TEXT,
  model TEXT,
  task_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Skills
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- Boards
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  agent_action_prompt TEXT,
  auto_move INTEGER NOT NULL DEFAULT 0,
  role_required TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cards
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES columns(id),
  parent_card_id TEXT REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('project', 'epic', 'task', 'bug')),
  title TEXT NOT NULL,
  description TEXT,
  assigned_agent_id TEXT REFERENCES agents(id),
  estimated_tokens INTEGER,
  estimated_cost_usd REAL,
  position INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_dependencies (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  depends_on_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, depends_on_card_id)
);

CREATE TABLE card_repos (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  repo_path TEXT NOT NULL,
  spec_path TEXT
);

CREATE TABLE card_comments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent')),
  author_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_attachments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Specs
CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'rejected')) DEFAULT 'draft',
  source_card_id TEXT REFERENCES cards(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE spec_reviews (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('user', 'agent')),
  reviewer_id TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'reject', 'comment')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Executions
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  spec_id TEXT REFERENCES specs(id),
  status TEXT NOT NULL CHECK (status IN ('planning', 'approving', 'executing', 'done', 'failed')) DEFAULT 'planning',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE execution_tasks (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  branch TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed', 'paused')) DEFAULT 'pending',
  agent_id TEXT REFERENCES agents(id),
  depends_on TEXT,
  pr_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE execution_gaps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  suggestion TEXT,
  response TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending'
);

CREATE TABLE execution_logs (
  id TEXT PRIMARY KEY,
  execution_task_id TEXT NOT NULL REFERENCES execution_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stdout', 'stderr', 'approval_request')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_cards_board ON cards(board_id);
CREATE INDEX idx_cards_column ON cards(column_id);
CREATE INDEX idx_cards_parent ON cards(parent_card_id);
CREATE INDEX idx_agent_cost_agent ON agent_cost_log(agent_id);
CREATE INDEX idx_agent_cost_created ON agent_cost_log(created_at);
CREATE INDEX idx_execution_tasks_exec ON execution_tasks(execution_id);
CREATE INDEX idx_execution_logs_task ON execution_logs(execution_task_id);
CREATE INDEX idx_specs_status ON specs(status);

-- ==========================================
-- Conversations
-- ==========================================
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('spec', 'plan', 'code', 'research', 'review')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused_for_user', 'completed')) DEFAULT 'active',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'user', 'system')),
  sender_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('content', 'question_for_agent', 'question_for_user', 'artifact')) DEFAULT 'content',
  mentions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- Agent Memory (long-term)
-- ==========================================
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  type TEXT NOT NULL CHECK (type IN ('conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  tags TEXT,
  embedding BLOB,
  relevance_score REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memory_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  conversation_id TEXT REFERENCES conversations(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  consolidated INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_conversations_card ON conversations(card_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(type);
CREATE INDEX idx_memory_sessions_agent ON memory_sessions(agent_id);
```

- [ ] **Step 7: Create WebSocket broadcast utility**

Create `packages/api/src/ws/broadcast.ts`:
```typescript
import type { WebSocket } from 'ws'

const clients = new Set<WebSocket>()

export function addClient(ws: WebSocket): void {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
}

export function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() })
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message)
    }
  }
}

export function clientCount(): number {
  return clients.size
}
```

- [ ] **Step 8: Create health route**

Create `packages/api/src/routes/health.ts`:
```typescript
import type { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection.js'
import { clientCount } from '../ws/broadcast.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_req, reply) => {
    const db = getDb()
    const tableCount = db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations'"
    ).get() as { count: number }

    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: {
        tables: tableCount.count,
      },
      ws: {
        clients: clientCount(),
      },
    })
  })
}
```

- [ ] **Step 9: Create Fastify server entry**

Create `packages/api/src/index.ts`:
```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { runMigrations } from './db/migrate.js'
import { addClient } from './ws/broadcast.js'
import { healthRoutes } from './routes/health.js'

const dbPath = process.env['DATABASE_PATH'] ?? 'data/orchestrator.db'
mkdirSync(dirname(dbPath), { recursive: true })

runMigrations()

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

await server.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
})

await server.register(websocket)

server.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, _req) => {
    addClient(socket)
  })
})

await server.register(healthRoutes)

const PORT = Number(process.env['PORT'] ?? 3001)
await server.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Gaud Orchestrator API listening on port ${PORT}`)
```

- [ ] **Step 10: Write tests**

Create `packages/api/src/__tests__/db.test.ts`:
```typescript
import { describe, it, expect, afterAll } from 'vitest'
import Database from 'better-sqlite3'

describe('SQLite migrations', () => {
  const db = new Database(':memory:')

  afterAll(() => db.close())

  it('creates all tables from migration SQL', async () => {
    const { readFileSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const sql = readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8')

    db.pragma('foreign_keys = ON')
    db.exec(sql)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('agents')
    expect(tableNames).toContain('boards')
    expect(tableNames).toContain('cards')
    expect(tableNames).toContain('columns')
    expect(tableNames).toContain('skills')
    expect(tableNames).toContain('specs')
    expect(tableNames).toContain('executions')
    expect(tableNames).toContain('execution_tasks')
    expect(tableNames).toContain('providers')
    expect(tableNames).toContain('conversations')
    expect(tableNames).toContain('messages')
    expect(tableNames).toContain('agent_memories')
    expect(tableNames).toContain('memory_sessions')
  })

  it('enforces foreign keys', () => {
    expect(() => {
      db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'nonexistent', 'col1', 'task', 'Test')").run()
    }).toThrow()
  })
})
```

Create `packages/api/src/__tests__/health.test.ts`:
```typescript
import { describe, it, expect, afterAll } from 'vitest'
import Fastify from 'fastify'
import { healthRoutes } from '../routes/health.js'
import Database from 'better-sqlite3'

// Setup in-memory DB for test
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('GET /api/health', () => {
  const app = Fastify()

  afterAll(async () => {
    await app.close()
  })

  it('returns ok status', async () => {
    await app.register(healthRoutes)
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })
})
```

- [ ] **Step 11: Run tests**

```bash
cd D:/development/ruflo/gaud-orchestrator
pnpm install
pnpm --filter @gaud/api test
```

Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add packages/api/
git commit -m "feat: add Fastify API with SQLite, migrations, WebSocket, and health route"
```

---

## Task 5: Web Package — React + Vite + Tailwind + Layout

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/styles/globals.css`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/store/app.ts`
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/components/ui/Button.tsx`
- Create: `packages/web/src/components/ui/ThemeToggle.tsx`
- Create: `packages/web/src/components/layout/Sidebar.tsx`
- Create: `packages/web/src/components/layout/Header.tsx`
- Create: `packages/web/src/components/layout/Layout.tsx`
- Create: `packages/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create package.json**

Create `packages/web/package.json`:
```json
{
  "name": "@gaud/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "@gaud/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.470.0",
    "react-router-dom": "^7.1.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Create `packages/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 4: Create index.html**

Create `packages/web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gaud Orchestrator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create Tailwind CSS with dark mode**

Create `packages/web/src/styles/globals.css` (tokens from DESIGN.md):
```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));

@theme {
  /* Typography — DESIGN.md: Inter + JetBrains Mono */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  /* Colors — DESIGN.md: The Mission Control Console palette */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-on-primary: #FFFFFF;

  --color-accent: #059669;
  --color-accent-hover: #047857;
  --color-on-accent: #FFFFFF;

  --color-destructive: #DC2626;
  --color-destructive-hover: #B91C1C;
  --color-on-destructive: #FFFFFF;

  --color-warning: #D97706;

  --color-surface: #F8FAFC;
  --color-surface-elevated: #F1F5F9;
  --color-ink: #0F172A;
  --color-muted: #64748B;
  --color-border: #E2E8F0;
  --color-ring: #2563EB;

  /* Dark mode colors */
  --color-surface-dark: #18181B;
  --color-surface-elevated-dark: #27272A;
  --color-ink-dark: #FAFAFA;
  --color-muted-dark: #A1A1AA;
  --color-border-dark: #27272A;

  /* Spacing — DESIGN.md: 4/8 system */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;
  --spacing-3xl: 48px;

  /* Radii — DESIGN.md */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}

@layer base {
  html {
    @apply bg-white text-[--color-ink] antialiased;
    font-family: var(--font-sans);
    font-size: 14px; /* DESIGN.md: 14px body default */
    line-height: 1.6;
  }
  html.dark {
    @apply bg-[#09090B] text-[--color-ink-dark];
  }
}
```

- [ ] **Step 6: Create Zustand store**

Create `packages/web/src/store/app.ts`:
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'gaud-app' }
  )
)
```

- [ ] **Step 7: Create API client**

Create `packages/web/src/api/client.ts`:
```typescript
const API_BASE = '/api'

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  health: () => request<{ status: string; timestamp: string }>('/health'),
}
```

- [ ] **Step 8: Create UI components**

Create `packages/web/src/components/ui/Button.tsx` (per DESIGN.md Components > Buttons):
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-[--radius-md] font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[--color-primary] text-[--color-on-primary] hover:bg-[--color-primary-hover]',
    secondary: 'bg-transparent text-[--color-ink] border border-[--color-border] hover:bg-[--color-surface] dark:text-[--color-ink-dark] dark:border-[--color-border-dark] dark:hover:bg-[--color-surface-dark]',
    ghost: 'text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]',
    destructive: 'bg-[--color-destructive] text-[--color-on-destructive] hover:bg-[--color-destructive-hover]',
  }
  const sizes = {
    sm: 'h-7 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-sm',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : null}
      {children}
    </button>
  )
}
```

Create `packages/web/src/components/ui/ThemeToggle.tsx` (Lucide icons per DESIGN.md):
```tsx
import { useAppStore } from '@/store/app'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="rounded-[--radius-md] p-2 text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark] cursor-pointer transition-colors duration-150"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
```

- [ ] **Step 9: Create layout components**

Create `packages/web/src/components/layout/Sidebar.tsx` (per DESIGN.md: Lucide icons, 224px width, navigation specs):
```tsx
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/app'
import {
  LayoutDashboard, Bot, Zap, Plug,
  Kanban, FileText, Play,
  Settings, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import type { ComponentType } from 'react'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ size?: number }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Agents',
    items: [
      { label: 'Agents', to: '/agents', icon: Bot },
      { label: 'Skills', to: '/skills', icon: Zap },
      { label: 'Providers', to: '/settings/providers', icon: Plug },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Boards', to: '/boards', icon: Kanban },
      { label: 'Specs', to: '/specs', icon: FileText },
      { label: 'Executions', to: '/executions', icon: Play },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <aside className={`flex flex-col border-r border-[--color-border] bg-white transition-all duration-200 dark:border-[--color-border-dark] dark:bg-[#09090B] ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex h-14 items-center justify-between border-b border-[--color-border] px-4 dark:border-[--color-border-dark]">
        {!sidebarCollapsed && (
          <span className="text-sm font-bold text-[--color-primary]">Gaud</span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-[--radius-md] p-1.5 text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark] cursor-pointer"
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {!sidebarCollapsed && (
              <div className="mb-1 px-3 text-[0.6875rem] font-medium uppercase tracking-wider text-[--color-muted] dark:text-[--color-muted-dark]">
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-[--radius-md] px-3 h-9 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-[--color-surface] text-[--color-primary] dark:bg-[--color-surface-dark] dark:text-[--color-primary]'
                      : 'text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]'
                  }`
                }
              >
                <item.icon size={18} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

Create `packages/web/src/components/layout/Header.tsx` (per DESIGN.md layout specs):
```tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[--color-border] bg-white px-6 dark:border-[--color-border-dark] dark:bg-[#09090B]">
      <div className="text-sm text-[--color-muted] dark:text-[--color-muted-dark]">
        Gaud Orchestrator
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
```

Create `packages/web/src/components/layout/Layout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[--color-surface] p-6 dark:bg-[--color-surface-dark]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Create Dashboard page**

Create `packages/web/src/pages/DashboardPage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { api } from '@/api/client'

export function DashboardPage() {
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(console.error)
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">API Status</div>
          <div className="mt-2 text-2xl font-bold">
            {health ? (
              <span className="text-[--color-accent]">{health.status}</span>
            ) : (
              <span className="text-[--color-muted]">Loading...</span>
            )}
          </div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Active Agents</div>
          <div className="mt-2 text-2xl font-bold">0</div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Pending Specs</div>
          <div className="mt-2 text-2xl font-bold">0</div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Cost This Month</div>
          <div className="mt-2 text-2xl font-bold">$0.00</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 11: Create App with router**

Create `packages/web/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { useEffect } from 'react'
import { useAppStore } from '@/store/app'

export function App() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* Placeholder routes — pages added in later phases */}
          <Route path="/agents" element={<Placeholder title="Agents" />} />
          <Route path="/skills" element={<Placeholder title="Skills" />} />
          <Route path="/boards" element={<Placeholder title="Boards" />} />
          <Route path="/specs" element={<Placeholder title="Specs" />} />
          <Route path="/executions" element={<Placeholder title="Executions" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="/settings/providers" element={<Placeholder title="Providers" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Coming in next phase.</p>
    </div>
  )
}
```

Create `packages/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 12: Install deps and verify**

```bash
cd D:/development/ruflo/gaud-orchestrator
pnpm install
pnpm dev
```

Expected: API on http://localhost:3001, Frontend on http://localhost:5173. Dashboard loads with layout, sidebar, header, dark mode toggle.

- [ ] **Step 13: Commit**

```bash
git add packages/web/
git commit -m "feat: add React frontend with Tailwind, layout shell, and dark mode"
```

---

## Task 6: Docker Compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
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
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:
```yaml
services:
  gaud-orchestrator:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - gaud-data:/app/data
      - ./agents:/app/agents
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/orchestrator.db
      - AGENTS_DIR=/app/agents
      - LOG_LEVEL=info

volumes:
  gaud-data:
```

- [ ] **Step 3: Verify Docker build**

```bash
docker compose build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker Compose for production deployment"
```

---

## Task 7: Copy Agent Definitions and Push

**Files:**
- Copy: `agents/` from rufloui

- [ ] **Step 1: Copy agent files**

```bash
cp -r D:/development/ruflo/rufloui/agents/* D:/development/ruflo/gaud-orchestrator/agents/
```

- [ ] **Step 2: Commit and push**

```bash
git add agents/
git commit -m "feat: add fiscal agent definitions"
git push -u origin main
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | GitHub repo + monorepo root (pnpm, tsconfig, gitignore) |
| 2 | @gaud/shared — all TypeScript types for the platform |
| 3 | @gaud/providers — AgentProvider interface + registry |
| 4 | @gaud/api — Fastify server, SQLite with full schema, WebSocket, health endpoint |
| 5 | @gaud/web — React + Tailwind + Layout (sidebar, header, dark mode, dashboard) |
| 6 | Docker Compose for production |
| 7 | Agent definition files + push to GitHub |

**After Phase 1:** The app starts, shows a layout with sidebar navigation, dark mode toggle, dashboard with health check, and has a complete SQLite schema ready for Phase 2 (Agents + Skills CRUD).
