# Gaud Orchestrator — Design Spec

## Resumo

Plataforma web para orquestrar equipes de agentes de IA com backlog management, Kanban customizavel, Spec Driven Development, e execucao automatica. Inspirado no Paperclip, adaptado para o ecossistema Gaud ERP.

GitHub: `gauderp/gaud-orchestrator`

## Motivacao

- Gerenciar backlog do time de desenvolvimento com visibilidade
- Automatizar execucao de specs/plans via agentes IA
- Gate de aprovacao: gerente de projetos aprova antes dos agentes executarem
- Suportar multiplos LLM providers (Claude, Gemini, OpenAI, DeepSeek, Cursor)
- Controlar custos por agente
- Fluxo SDD: agente analisa codebase → gera spec → aprovacao → tasks no Kanban

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Fastify + WebSocket (via @fastify/websocket) |
| Banco | SQLite (better-sqlite3) |
| Monorepo | pnpm workspaces |
| Deploy | Docker Compose |
| Linguagem | TypeScript |

## Estrutura do Monorepo

```
gaud-orchestrator/
├── packages/
│   ├── web/              # Frontend React 19 + Vite + Tailwind
│   │   ├── src/
│   │   │   ├── components/    # UI components reutilizaveis
│   │   │   ├── pages/         # Paginas da aplicacao
│   │   │   ├── store/         # Zustand stores (por dominio)
│   │   │   ├── api/           # Typed API client
│   │   │   ├── hooks/         # React hooks customizados
│   │   │   └── styles/        # Tailwind config, global CSS
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── api/              # Backend Fastify + SQLite + WebSocket
│   │   ├── src/
│   │   │   ├── routes/        # Fastify route modules (1 file per domain)
│   │   │   ├── services/      # Business logic
│   │   │   ├── db/            # SQLite setup, migrations, queries
│   │   │   ├── ws/            # WebSocket broadcast
│   │   │   └── index.ts       # Fastify server entry
│   │   ├── migrations/        # SQL migration files
│   │   └── package.json
│   │
│   ├── providers/        # LLM provider interface + implementations
│   │   ├── src/
│   │   │   ├── interface.ts       # AgentProvider interface
│   │   │   ├── claude-cli.ts      # Claude Code CLI provider
│   │   │   ├── claude-api.ts      # Claude API (Anthropic SDK)
│   │   │   ├── openai.ts          # OpenAI API provider
│   │   │   ├── gemini.ts          # Google Gemini provider
│   │   │   ├── deepseek.ts        # DeepSeek provider
│   │   │   ├── cursor.ts          # Cursor CLI provider
│   │   │   └── registry.ts        # Provider registry
│   │   └── package.json
│   │
│   └── shared/           # Types, constantes, utils compartilhados
│       ├── src/
│       │   ├── types/         # Todas as interfaces (Agent, Card, Spec, etc.)
│       │   ├── constants.ts   # Enums, defaults
│       │   └── utils.ts       # Helpers puros
│       └── package.json
│
├── agents/               # Agent definitions (.md files)
│   ├── gaud-fiscal.md
│   ├── gaud-nfse-belo-horizonte-mg.md
│   ├── gaud-nfse-catalao-go.md
│   ├── gaud-nfse-thema-sao-leopoldo.md
│   ├── gaud-nfse-tributos-municipais.md
│   ├── gaud-sefaz-distribution.md
│   └── tributos-brasil.md
│
├── docker-compose.yml
├── Dockerfile
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .gitignore
```

## Decisoes de Design

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Monorepo | pnpm workspaces | Types compartilhados, deploy unico, DX |
| Frontend | React 19 + Vite + Tailwind | Moderno, rapido, utility-first CSS (light/dark) |
| Backend | Fastify | Mais performatico que Express, schema validation nativo |
| Banco | SQLite (better-sqlite3) | Sincrono, zero infra, suficiente para um time |
| State mgmt | Zustand (por dominio) | Leve, sem boilerplate, ja validado no RuFloUI |
| Realtime | WebSocket (@fastify/websocket) | Logs ao vivo, updates de status |
| LLM | Interface plugavel | Suporta qualquer provider sem mudar core |
| Theme | Tailwind dark: variant | Light e dark nativos |
| Drag-and-drop | @dnd-kit/core | Leve, acessivel, React-first |

---

## Modulo 1: Agents

### Funcionalidades

- **Hierarquia visual**: org chart em arvore mostrando agentes e linhas de reporte
- **CRUD de agentes**: nome, role, instructions (markdown editavel), provider, modelo, cost limit
- **Provider selector**: escolher qual LLM runtime o agente usa
- **Cost tracking**: tokens in/out, custo acumulado por agente, hard-stop ao atingir limite
- **Skills assignment**: atribuir/remover skills de um agente (many-to-many)
- **Agent definitions**: arquivos .md em `agents/` carregados no boot como templates

### Provider Interface

```typescript
interface SpawnOpts {
  prompt: string
  cwd: string
  env?: Record<string, string>
  model?: string
}

interface OutputEvent {
  type: 'stdout' | 'stderr' | 'approval_request' | 'cost'
  content: string
  timestamp: string
  tokens?: { input: number; output: number }
  cost?: number
}

interface AgentSession {
  id: string
  status: 'running' | 'paused' | 'done' | 'failed'
}

interface AgentProvider {
  id: string
  name: string
  models: string[]
  spawn(opts: SpawnOpts): Promise<AgentSession>
  send(sessionId: string, message: string): Promise<void>
  kill(sessionId: string): Promise<void>
  onOutput(sessionId: string, cb: (event: OutputEvent) => void): void
  estimateCost(model: string, tokens: { input: number; output: number }): number
}
```

### Providers iniciais

| Provider | Runtime | Como funciona |
|----------|---------|---------------|
| `claude-cli` | Claude Code CLI | `spawn('claude', ['-p', prompt])` |
| `claude-api` | Anthropic SDK | `anthropic.messages.create()` |
| `openai` | OpenAI SDK | `openai.chat.completions.create()` |
| `gemini` | Google AI SDK | `genai.generateContent()` |
| `deepseek` | OpenAI-compatible | Mesmo SDK, endpoint diferente |
| `cursor` | Cursor CLI | `spawn('cursor', ['--agent', prompt])` |

### Cost Model

Cada provider reporta tokens in/out via `OutputEvent`. O sistema:
1. Registra em `agent_cost_log` por operacao
2. Agrega por agente/mes
3. Compara com `cost_limit_usd` do agente
4. Hard-stop: se custo >= limite, pausa agente, notifica via WebSocket

### Telas

- **Agent List**: org chart (arvore colapsavel) + lista, botao criar agente
- **Agent Detail**: form com instructions editor (textarea markdown), provider/model dropdown, cost limit input, skills chips, grafico de custo do mes
- **Provider Config**: lista de providers, config de API keys (masked), testar conexao

---

## Modulo 2: Skills

### Funcionalidades

- **CRUD**: criar, editar, deletar skills
- **Editor markdown**: conteudo da skill editavel inline
- **Assignment**: atribuir skills a agentes (via Agent Detail)
- **Injecao**: quando agente executa task, skills atribuidas sao injetadas no prompt

### Telas

- **Skills List**: tabela com nome, descricao, agentes que usam, acoes (edit/delete)
- **Skill Editor**: page com nome, descricao, editor markdown para conteudo

---

## Modulo 3: Task Management (Kanban)

### Funcionalidades

#### Boards
- CRUD de boards
- Colunas customizaveis: nome, cor, posicao (drag-and-drop para reordenar)
- Cada coluna tem prompt de acao do agente (opcional) — ex: "Gere um spec a partir da descricao deste card"
- Auto-move: ao completar acao, card move automaticamente para proxima coluna
- Sem roles por enquanto, mas campo `role_required` na tabela columns (nullable) para futuro

#### Cards
- **Hierarquia**: Project > Epic > Task/Bug
- Task e Bug podem existir sem parent (standalone)
- Campos: titulo, descricao, type (project/epic/task/bug), repos[] (multi-repo), spec_path, agent atribuido
- **Estimativa de custo**: antes de executar, agente analisa a task e estima tokens/custo
- **Comentarios**: usuario ou agente (inline invocation — "pedir para agente avaliar")
- **Anexos**: arquivos linkados ao card
- **Drag-and-drop**: mover cards entre colunas e reordenar dentro da coluna

#### Acao automatica por coluna
Quando card chega em coluna com `agent_action_prompt`:
1. Sistema resolve qual agente usar (assigned_agent_id do card, ou default do board)
2. Injeta prompt da coluna + contexto do card (titulo, descricao, repos, spec)
3. Agente executa, output vai para comentarios do card
4. Se auto_move=true, card avanca para proxima coluna
5. Se agente emite [APPROVAL_NEEDED], card pausa e notifica usuario

#### Exemplos de colunas configuradas

```
Backlog          → sem acao (manual)
Spec             → prompt: "Analise o codebase dos repos deste card e gere um spec draft"
Review           → prompt: "Revise este spec e aponte gaps, ambiguidades e melhorias"
Approved         → prompt: "Decomponha o spec em tasks e execute via SDD"
Executing        → sem acao (sistema monitora execucoes em andamento)
Done             → sem acao
```

### Telas

- **Board View**: Kanban com colunas, cards draggable, filtros (type, agent, status)
- **Board Settings**: gerenciar colunas (nome, cor, prompt, auto-move), reordenar
- **Card Detail**: modal ou page com todas as informacoes, comentarios, anexos, botao "Ask Agent", estimativa de custo

---

## Modulo 4: SDD (Spec Driven Development)

### Funcionalidades

#### Spec Generation
1. Usuario seleciona repos + descreve o que quer ("Implementar NFS-e para Catalao")
2. Agente (com Graphify + grep + read) analisa codebase
3. Gera draft de spec em markdown
4. Spec fica com status `draft`

#### Spec Review
1. Specs em `draft` ou `review` aparecem na lista de review
2. Reviewer (usuario ou agente) pode aprovar, rejeitar, ou comentar
3. Historico de versoes do spec (cada edicao gera nova versao)
4. Aprovacao muda status para `approved`

#### Spec → Tasks
1. Spec aprovado pode ser decomposto em cards no Kanban
2. Sistema usa o Orchestrator (ja implementado) para gerar tasks
3. Cards criados automaticamente no board selecionado, na coluna "Backlog" (ou configuravel)
4. Cada card referencia o spec de origem

### Telas

- **Spec Studio**: form com repos selector + descricao, botao "Generate Spec", preview do draft
- **Spec Review**: lista de specs por status (draft/review/approved/rejected), diff viewer entre versoes, botoes aprovar/rejeitar, comentarios inline
- **Spec → Board**: ao aprovar, modal para escolher board e configurar decomposicao

---

## Modelo de Dados (SQLite)

```sql
-- ==========================================
-- Providers
-- ==========================================
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'claude-cli', 'claude-api', 'openai', 'gemini', 'deepseek', 'cursor'
  config_json TEXT NOT NULL DEFAULT '{}',  -- API keys, endpoints (encrypted at rest)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- Agents
-- ==========================================
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  instructions TEXT,  -- markdown
  provider_id TEXT REFERENCES providers(id),
  model TEXT,
  cost_limit_usd REAL DEFAULT 0,  -- 0 = unlimited
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
  task_id TEXT,  -- execution_task or card
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- Skills
-- ==========================================
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,  -- markdown
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- ==========================================
-- Boards & Kanban
-- ==========================================
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
  agent_action_prompt TEXT,  -- null = no auto action
  auto_move INTEGER NOT NULL DEFAULT 0,  -- boolean: move to next column on complete
  role_required TEXT,  -- future: role needed to move cards here
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  author_id TEXT,  -- agent_id or user identifier
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

-- ==========================================
-- SDD / Specs
-- ==========================================
CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- markdown
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

-- ==========================================
-- Executions
-- ==========================================
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
  depends_on TEXT,  -- JSON array of execution_task ids
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

-- ==========================================
-- Indexes
-- ==========================================
CREATE INDEX idx_cards_board ON cards(board_id);
CREATE INDEX idx_cards_column ON cards(column_id);
CREATE INDEX idx_cards_parent ON cards(parent_card_id);
CREATE INDEX idx_agent_cost_agent ON agent_cost_log(agent_id);
CREATE INDEX idx_agent_cost_created ON agent_cost_log(created_at);
CREATE INDEX idx_execution_tasks_exec ON execution_tasks(execution_id);
CREATE INDEX idx_execution_logs_task ON execution_logs(execution_task_id);
CREATE INDEX idx_specs_status ON specs(status);
```

## API Routes (Fastify)

### Agents
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/agents | Listar agentes (com hierarquia) |
| POST | /api/agents | Criar agente |
| GET | /api/agents/:id | Detalhe do agente |
| PUT | /api/agents/:id | Atualizar agente |
| DELETE | /api/agents/:id | Deletar agente |
| GET | /api/agents/:id/cost | Custo acumulado do agente |
| POST | /api/agents/:id/skills | Atribuir skill |
| DELETE | /api/agents/:id/skills/:skillId | Remover skill |

### Skills
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/skills | Listar skills |
| POST | /api/skills | Criar skill |
| GET | /api/skills/:id | Detalhe |
| PUT | /api/skills/:id | Atualizar |
| DELETE | /api/skills/:id | Deletar |

### Boards
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/boards | Listar boards |
| POST | /api/boards | Criar board |
| GET | /api/boards/:id | Board com colunas e cards |
| PUT | /api/boards/:id | Atualizar board |
| DELETE | /api/boards/:id | Deletar board |

### Columns
| Method | Path | Descricao |
|--------|------|-----------|
| POST | /api/boards/:boardId/columns | Criar coluna |
| PUT | /api/columns/:id | Atualizar coluna (nome, cor, prompt, auto-move) |
| DELETE | /api/columns/:id | Deletar coluna |
| PUT | /api/boards/:boardId/columns/reorder | Reordenar colunas |

### Cards
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/boards/:boardId/cards | Listar cards do board |
| POST | /api/cards | Criar card |
| GET | /api/cards/:id | Detalhe do card |
| PUT | /api/cards/:id | Atualizar card |
| DELETE | /api/cards/:id | Deletar card |
| PUT | /api/cards/:id/move | Mover card (column_id, position) — trigger de acao |
| POST | /api/cards/:id/comments | Adicionar comentario |
| POST | /api/cards/:id/ask-agent | Invocar agente inline no card |
| POST | /api/cards/:id/estimate | Estimar custo de implementacao |
| POST | /api/cards/:id/repos | Adicionar repo ao card |
| DELETE | /api/cards/:id/repos/:repoId | Remover repo |

### Specs (SDD)
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/specs | Listar specs (filtro por status) |
| POST | /api/specs | Criar spec manual |
| POST | /api/specs/generate | Gerar spec via agente (repos + descricao) |
| GET | /api/specs/:id | Detalhe com versoes |
| PUT | /api/specs/:id | Editar spec (gera nova versao) |
| POST | /api/specs/:id/review | Submeter review (approve/reject/comment) |
| POST | /api/specs/:id/decompose | Decompor spec em cards no board |

### Executions
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/executions | Listar execucoes |
| GET | /api/executions/:id | Detalhe com tasks e logs |
| POST | /api/executions/:id/execute | Iniciar execucao |
| POST | /api/executions/:id/cancel | Cancelar |
| POST | /api/executions/:id/gaps/:gapId/resolve | Resolver gap |

### Providers
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/providers | Listar providers configurados |
| POST | /api/providers | Configurar provider |
| PUT | /api/providers/:id | Atualizar config |
| DELETE | /api/providers/:id | Remover provider |
| POST | /api/providers/:id/test | Testar conexao |

### WebSocket Events
| Event | Direcao | Descricao |
|-------|---------|-----------|
| card:moved | server→client | Card movido de coluna |
| card:updated | server→client | Card atualizado |
| card:comment | server→client | Novo comentario (user ou agente) |
| agent:output | server→client | Output de agente em tempo real |
| agent:cost | server→client | Atualizacao de custo |
| agent:status | server→client | Status do agente mudou |
| execution:updated | server→client | Execucao mudou de status |
| execution:task:log | server→client | Log de task em tempo real |
| spec:updated | server→client | Spec criado/atualizado |

## Telas do Frontend

### Layout
- Sidebar colapsavel (220px → 64px)
- Header com breadcrumb + theme toggle (light/dark) + notifications
- Content area responsiva

### Pages

| Grupo | Rota | Componente | Descricao |
|-------|------|-----------|-----------|
| Dashboard | / | DashboardPage | Cards em execucao, agentes ativos, custo do mes, specs pendentes |
| Agents | /agents | AgentListPage | Org chart hierarquico + lista |
| | /agents/:id | AgentDetailPage | Instructions editor, provider, cost, skills |
| | /settings/providers | ProviderConfigPage | API keys, endpoints, test connection |
| Skills | /skills | SkillsListPage | CRUD lista |
| | /skills/:id | SkillEditorPage | Editor markdown |
| Boards | /boards | BoardListPage | Lista de boards |
| | /boards/:id | BoardViewPage | Kanban com drag-and-drop |
| | /boards/:id/settings | BoardSettingsPage | Colunas config |
| Cards | /cards/:id | CardDetailPage | Modal ou page com tudo |
| SDD | /specs/studio | SpecStudioPage | Gerar spec via agente |
| | /specs | SpecReviewPage | Lista specs, aprovar/rejeitar |
| | /specs/:id | SpecDetailPage | Conteudo, versoes, reviews |
| Executions | /executions | ExecutionListPage | Lista de execucoes |
| | /executions/:id | ExecutionDetailPage | Tasks, logs ao vivo, PRs |
| Settings | /settings | SettingsPage | Tema, preferencias |

## Docker Compose

```yaml
services:
  gaud-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"    # frontend
      - "3001:3001"    # API
    volumes:
      - gaud-data:/app/data          # SQLite DB
      - gaud-agents:/app/agents      # Agent definitions
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/orchestrator.db
      - AGENTS_DIR=/app/agents

volumes:
  gaud-data:
  gaud-agents:
```

```dockerfile
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ packages/
COPY agents/ agents/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gaud/web build
RUN pnpm --filter @gaud/api build

EXPOSE 3000 3001

CMD ["node", "packages/api/dist/index.js"]
```

O Fastify serve o build do frontend como static files + API na mesma porta (3001), ou duas portas separadas em dev.

## Fluxo Principal

```
1. Usuario cria card no Kanban ("Implementar NFS-e Catalao")
   → type: task, repos: [gaud-erp-api], description breve

2. Card movido para coluna "Spec"
   → Agente analisa codebase via Graphify + grep
   → Gera spec draft, salva como comentario + cria Spec
   → Auto-move para "Review"

3. Gerente de projetos revisa spec
   → Aprova ou pede mudancas
   → Spec status: approved

4. Card movido para coluna "Approved"
   → Orchestrator decompoe spec em execution tasks
   → Atribui agentes especializados (gaud-nfse-catalao-go)
   → Executa em paralelo via provider configurado
   → PRs gerados automaticamente

5. Card auto-move para "Executing"
   → Dashboard mostra progresso ao vivo

6. Ao completar, auto-move para "Done"
   → PRs linkados no card
   → Custo total registrado
```

## Modulos reutilizados do RuFloUI

Os seguintes modulos migram intactos para `packages/api/src/services/`:

| Modulo | Origem | Destino |
|--------|--------|---------|
| spec-parser.ts | rufloui/src/backend/ | api/src/services/spec-parser.ts |
| orchestrator.ts | rufloui/src/backend/ | api/src/services/orchestrator.ts |
| session-manager.ts | rufloui/src/backend/ | api/src/services/session-manager.ts |
| git-manager.ts | rufloui/src/backend/ | api/src/services/git-manager.ts |
| agent-loader.ts | rufloui/src/backend/ | api/src/services/agent-loader.ts |

O `execution-store.ts` sera substituido pelo SQLite (tabelas executions, execution_tasks, etc).

## Fases de Implementacao

### Fase 1 — Scaffold + Infra
- Criar repo gauderp/gaud-orchestrator
- Scaffold monorepo (pnpm, tsconfig, packages)
- Setup Fastify + SQLite + migrations
- Setup React + Vite + Tailwind + Zustand
- Docker Compose
- Layout base (sidebar, header, theme toggle)

### Fase 2 — Agents + Providers + Skills
- Provider interface + implementacao claude-cli
- CRUD de agents com hierarquia
- Cost tracking
- CRUD de skills
- Agent-skill assignment
- Telas: AgentList, AgentDetail, ProviderConfig, SkillsList, SkillEditor

### Fase 3 — Kanban + Cards
- CRUD de boards e colunas customizaveis
- Cards com hierarquia (project/epic/task/bug)
- Drag-and-drop (@dnd-kit)
- Multi-repo por card
- Comentarios (user + agent)
- Acao automatica por coluna (prompt → agente → comentario → auto-move)
- Estimativa de custo
- Telas: BoardView, BoardSettings, CardDetail

### Fase 4 — SDD
- Spec generation via agente (Graphify + codebase analysis)
- Spec review workflow (draft → review → approved)
- Versioning de specs
- Decomposicao: spec → cards no Kanban
- Telas: SpecStudio, SpecReview, SpecDetail

### Fase 5 — Executions
- Migrar orchestrator/session-manager para novo backend
- Integracao com cards (card → execution)
- Logs ao vivo via WebSocket
- PR creation
- Telas: ExecutionList, ExecutionDetail

### Fase 6 — Providers adicionais
- claude-api provider
- openai provider
- gemini provider
- deepseek provider
- cursor provider
- Provider test connection

### Fase 7 — Polish + Deploy
- Dashboard com metricas
- Responsividade
- Error handling robusto
- Docker production build
- Documentacao
