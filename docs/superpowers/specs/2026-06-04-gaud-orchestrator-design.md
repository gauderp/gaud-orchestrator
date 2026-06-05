# Gaud Orchestrator — Design Spec

## Resumo

Plataforma web para orquestrar equipes de agentes de IA com backlog management, Kanban customizavel, Spec Driven Development, conversas colaborativas entre agentes, memoria de longo prazo, e aprendizado com erros. LLM-agnostic e token-efficient. Inspirado no Paperclip, adaptado para o ecossistema Gaud ERP.

GitHub: `gauderp/gaud-orchestrator`

## Motivacao

- Gerenciar backlog do time de desenvolvimento com visibilidade
- Automatizar execucao de specs/plans via agentes IA
- Gate de aprovacao: gerente de projetos aprova antes dos agentes executarem
- Suportar multiplos LLM providers (Claude, Gemini, OpenAI, DeepSeek, Cursor)
- Controlar custos por agente
- Fluxo SDD: agente analisa codebase → gera spec → aprovacao → tasks no Kanban
- Agentes colaboram em conversas para elaborar specs, plans, e codigo
- Memoria de longo prazo: agentes lembram contexto entre sessoes via vector DB
- Aprendizado com erros: agentes registram e consultam experiencias passadas

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Fastify + WebSocket (via @fastify/websocket) |
| Banco | SQLite (better-sqlite3) + sqlite-vec (vector search) |
| Vector memory | @claude-flow/memory (HNSW + hierarchical + graph) |
| Embeddings | Provider LLM embeddings (OpenAI, Gemini) + fallback ONNX local |
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
│   │   │   │   ├── memory.ts      # AgentMemory fachada (@claude-flow/memory)
│   │   │   │   ├── conversation.ts # Conversation Engine (turn-based loop)
│   │   │   │   ├── learning.ts    # Error Learning (detect + store + inject)
│   │   │   │   └── embeddings.ts  # EmbeddingProvider registry (LLM-agnostic)
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
| Banco | SQLite (better-sqlite3) + sqlite-vec | Sincrono, zero infra, vector search nativo |
| Long memory | @claude-flow/memory (fachada) | Hierarchical memory, graph queries, sessions — ja pronto |
| Embeddings | Provider LLM + fallback ONNX | Cada provider gera seus embeddings; custo desprezivel |
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

## Modulo 5: Conversation Engine

Agentes colaboram em conversas para produzir artefatos (specs, plans, codigo, pesquisas). Cada card/task pode ter uma conversa onde multiplos agentes especialistas interagem entre si e com o usuario.

### Conceito

Uma conversa e um "chat room" por task onde:
- Multiplos agentes participam, cada um com sua especialidade
- Agentes podem mencionar outros agentes (@agent-name)
- Gaps que nenhum agente resolve escalam para o usuario
- A conversa produz um artefato final (spec, plan, codigo)

### Turn-based Loop

```
1. Orchestrator cria conversa e convida agentes relevantes
2. Loop:
   a. Monta prompt para o proximo agente:
      - Knowledge do agente (instructions + skills)
      - Resumo da conversa (long memory)
      - Ultimas N mensagens (short-term context)
      - Memorias relevantes do vector DB (RAG)
   b. Agente responde com:
      - Conteudo (contribuicao normal)
      - @agent-name pergunta → proximo turno e daquele agente
      - [QUESTION_FOR_USER] → pausa, notifica usuario via WebSocket
      - [ARTIFACT] → conversa produz resultado final
   c. Se pergunta para usuario → pausa, espera resposta
   d. Se artifact → conversa completa, resultado linkado ao card
   e. Max turns sem progresso → orchestrator pede conclusao
```

### Token Efficiency

Cada turno de agente recebe contexto otimizado:

| Camada | Conteudo | Tokens |
|--------|---------|--------|
| Agent knowledge | Instructions + skills | ~1-3k (fixo) |
| Conversation summary | Resumo comprimido do historico | ~500-1k |
| Recent messages | Ultimas 5-10 mensagens raw | ~1-2k |
| RAG memories | Memorias relevantes do vector DB | ~500-1k |
| **Total por turno** | | **~3-7k tokens de contexto** |

Mesmo conversas longas (100+ mensagens) consomem contexto fixo gracas ao resumo + RAG.

### Quem decide o proximo agente?

O orchestrator decide baseado em:
1. Se agente mencionou outro (@fiscal → proximo e fiscal)
2. Round-robin entre agentes convidados
3. Se nenhum agente mencionado, o mais relevante para o ultimo topico (via similarity no vector DB)

### Telas

- **Conversation View** (aba no CardDetail): chat ao vivo com mensagens de agentes e usuario
- Cada mensagem mostra: avatar do agente, nome, role, timestamp
- Perguntas para usuario destacadas com banner amarelo
- Artifacts linkados ao final
- Botao "Add Agent" para convidar mais agentes na conversa

---

## Modulo 6: Agent Memory (Long-term)

Memoria persistente entre sessoes usando @claude-flow/memory como backend, acessada via fachada propria.

### Arquitetura de Memoria

```
Context Window (short-term)     Vector DB (long-term)      SQLite (audit)
  Resumo + ultimas N msgs         Toda conversa embedada     Historico raw
  ~3-7k tokens                    Busca semantica            Nunca vai pro prompt
         |                               |
         └──── Agente pergunta ──────────┘
               "O que ja discutimos       
                sobre certificado?"       
               → chunks relevantes        
```

### Tipos de Memoria

| Tipo | O que armazena | Quando consulta |
|------|---------------|-----------------|
| **Conversation** | Mensagens de conversas | Ao iniciar nova conversa sobre mesmo topico |
| **Error correction** | Erro + contexto + fix | Ao enfrentar task similar |
| **Pattern success** | Abordagem que funcionou | Ao enfrentar task similar |
| **Code knowledge** | Como algo funciona no codebase | Ao tocar no mesmo codigo |
| **User preferences** | Correcoes/preferencias do usuario | Sempre (injeta no prompt base) |

### Fachada AgentMemory

```typescript
// packages/api/src/services/memory.ts

interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>
  dimensions: number
}

class AgentMemory {
  constructor(
    private backend: CloudFlowMemoryBackend,  // @claude-flow/memory
    private embeddings: EmbeddingProvider,
  ) {}

  // Store
  store(opts: {
    agentId: string
    type: 'conversation' | 'error_correction' | 'pattern_success' | 'code_knowledge' | 'user_preference'
    content: string
    metadata: Record<string, unknown>
    tags: string[]
  }): Promise<void>

  // Search (semantic)
  search(query: string, opts?: {
    agentId?: string
    type?: string
    limit?: number
  }): Promise<MemoryEntry[]>

  // Session lifecycle
  startSession(agentId: string, conversationId: string): Promise<string>
  endSession(sessionId: string): Promise<void>  // triggers consolidation

  // Summarize conversation for context injection
  summarize(conversationId: string): Promise<string>

  // Consolidate: compress old memories, promote patterns
  consolidate(): Promise<void>
}
```

### Embedding Providers (LLM-agnostic)

```typescript
// Usa o mesmo provider do agente para gerar embeddings
const embeddingProviders: Record<string, EmbeddingProvider> = {
  'openai': {
    dimensions: 1536,
    generateEmbedding: (text) => openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
  },
  'gemini': {
    dimensions: 768,
    generateEmbedding: (text) => genai.embedContent({ model: 'text-embedding-004', content: text })
  },
  'local': {
    dimensions: 384,
    generateEmbedding: (text) => transformers.pipeline('feature-extraction', text)  // ONNX fallback
  }
}
```

Custo de embeddings e desprezivel (~$0.02/1M tokens OpenAI, gratuito Gemini).

### Telas

- **Agent Detail**: aba "Memory" mostrando memorias armazenadas, filtro por tipo, busca
- **Dashboard**: widget "Learnings this month" (quantas memorias de erro/sucesso)

---

## Modulo 7: Error Learning

Sistema para agentes aprenderem com erros e acertos. Integrado ao AgentMemory.

### Fluxo de Aprendizado

```
1. Agente comete erro
   - Test falha
   - PR rejeitado
   - Usuario corrige na conversa
   - Spec review rejeita

2. Sistema detecta e registra experiencia
   memory.store({
     agentId: 'gaud-nfse-catalao',
     type: 'error_correction',
     content: 'versaoDados 2.04 rejeitado, Catalao usa 2.01',
     metadata: {
       task: 'NFS-e Catalao XML',
       error: 'SEFAZ rejeicao codigo 123',
       fix: 'Configurar versaoDados=2.01 por municipio',
     },
     tags: ['nfse', 'catalao', 'abrasf', 'versao']
   })

3. Proxima task similar
   - Vector search retorna experiencia passada
   - Prompt inclui: "APRENDIZADO ANTERIOR: Catalao usa versaoDados 2.01"
   - Agente acerta de primeira
```

### Tipos de Eventos que Geram Aprendizado

| Evento | Tipo de memoria | Deteccao |
|--------|----------------|----------|
| Test falha → fix aplicado | error_correction | exit code + commit subsequente |
| PR rejeitado com comentarios | error_correction | GitHub webhook / review comment |
| Usuario corrige agente na conversa | error_correction + user_preference | Mensagem do usuario apos erro |
| Spec review rejeita | error_correction | spec_reviews.verdict = 'reject' |
| Task concluida com sucesso | pattern_success | execution_task.status = 'done' |
| Agente descobre padrao no codebase | code_knowledge | Agente armazena via tool |

### Injecao no Prompt

Antes de cada turno do agente, o sistema:

```typescript
// 1. Busca memorias relevantes
const memories = await agentMemory.search(taskContext, {
  agentId: agent.id,
  limit: 5,
})

// 2. Formata como secao do prompt
const learnings = memories
  .filter(m => m.type === 'error_correction' || m.type === 'pattern_success')
  .map(m => `- ${m.content}`)
  .join('\n')

// 3. Injeta no prompt
const prompt = `
## Previous Learnings
${learnings || 'No previous learnings for this context.'}

## Your Task
...
`
```

### Consolidacao (NightlyLearner equivalent)

Periodicamente (diario ou sob demanda):
1. Agrupa memorias similares (vector similarity > 0.9)
2. Merge duplicatas em uma memoria consolidada
3. Promove patterns frequentes (3+ ocorrencias) para "core knowledge"
4. Descarta memorias de erro corrigidas ha muito tempo (TTL configurable)

### Metricas

- **Error repeat rate**: quantas vezes o mesmo tipo de erro ocorre (deve diminuir)
- **Learning effectiveness**: % de tasks onde memoria foi consultada E task teve sucesso
- **Memory growth**: total de memorias por tipo por agente

### Telas

- **Agent Detail > Memory tab**: lista de memorias com tipo, conteudo, data, relevancia
- **Dashboard**: widget "Error Learning" com metricas do mes

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
-- Conversations
-- ==========================================
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('spec', 'plan', 'code', 'research', 'review')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused_for_user', 'completed')) DEFAULT 'active',
  summary TEXT,  -- compressed summary for token efficiency
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
  sender_id TEXT,  -- agent_id, 'user', or 'system'
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('content', 'question_for_agent', 'question_for_user', 'artifact')) DEFAULT 'content',
  mentions TEXT,  -- JSON array of agent_ids mentioned
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
  tags TEXT,  -- JSON array of tags
  embedding BLOB,  -- vector embedding for similarity search
  relevance_score REAL DEFAULT 0,  -- increases with successful recalls
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memory_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  conversation_id TEXT REFERENCES conversations(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  consolidated INTEGER NOT NULL DEFAULT 0  -- boolean: has NightlyLearner run?
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
CREATE INDEX idx_conversations_card ON conversations(card_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(type);
CREATE INDEX idx_memory_sessions_agent ON memory_sessions(agent_id);
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

### Conversations
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/cards/:cardId/conversations | Listar conversas do card |
| POST | /api/conversations | Criar conversa (com card_id, type, agent_ids[]) |
| GET | /api/conversations/:id | Detalhe com mensagens |
| GET | /api/conversations/:id/messages | Mensagens paginadas |
| POST | /api/conversations/:id/messages | Enviar mensagem (usuario) |
| POST | /api/conversations/:id/add-agent | Convidar agente para conversa |
| POST | /api/conversations/:id/next-turn | Trigger proximo turno de agente |
| POST | /api/conversations/:id/pause | Pausar conversa |
| POST | /api/conversations/:id/resume | Retomar conversa (apos resposta usuario) |

### Memory
| Method | Path | Descricao |
|--------|------|-----------|
| GET | /api/agents/:id/memories | Listar memorias do agente (filtro por type) |
| POST | /api/agents/:id/memories | Criar memoria manual |
| GET | /api/agents/:id/memories/search | Busca semantica nas memorias |
| DELETE | /api/memories/:id | Deletar memoria |
| POST | /api/memory/consolidate | Trigger consolidacao manual |
| GET | /api/memory/stats | Metricas de memoria (total por tipo, por agente) |

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
| conversation:message | server→client | Nova mensagem na conversa (agente ou usuario) |
| conversation:status | server→client | Status da conversa mudou (active/paused/completed) |
| conversation:question | server→client | Agente tem pergunta para usuario (highlight) |
| conversation:artifact | server→client | Conversa produziu artefato |
| memory:stored | server→client | Nova memoria armazenada |
| memory:learning | server→client | Agente aprendeu com erro (notificacao) |

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
| Conversations | /conversations/:id | ConversationPage | Chat ao vivo, mensagens, perguntas pendentes |
| Memory | /agents/:id/memory | AgentMemoryPage | Memorias do agente, busca, filtros por tipo |
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
   → Conversa inicia com agentes relevantes:
     - gaud-fiscal (regras tributarias)
     - gaud-nfse-catalao (integracao especifica)
     - coder (implementacao)
   → Agentes colaboram, analisam codebase, discutem abordagem
   → Se gap: [QUESTION_FOR_USER] → pausa, usuario responde
   → Agentes consultam memorias de projetos anteriores
   → Conversa produz artifact: spec draft
   → Auto-move para "Review"

3. Gerente de projetos revisa spec
   → Pode pedir para agente reviewer avaliar tambem (conversa)
   → Aprova ou pede mudancas
   → Spec status: approved

4. Card movido para coluna "Approved"
   → Orchestrator decompoe spec em execution tasks
   → Atribui agentes especializados com base no knowledge
   → Cada task pode ter sua propria conversa (agentes discutem implementacao)
   → Executa em paralelo via provider configurado
   → PRs gerados automaticamente

5. Card auto-move para "Executing"
   → Dashboard mostra progresso ao vivo
   → Conversas dos agentes visiveis em tempo real

6. Ao completar, auto-move para "Done"
   → PRs linkados no card
   → Custo total registrado
   → Memorias armazenadas:
     - pattern_success: abordagens que funcionaram
     - code_knowledge: como funciona o codigo tocado
     - error_correction: erros encontrados e como foram resolvidos
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
- Setup Fastify + SQLite + migrations (schema completo incluindo conversations e memories)
- Setup React + Vite + Tailwind + Zustand
- Docker Compose
- Layout base (sidebar, header, theme toggle)
- **Plano ja criado:** `docs/superpowers/plans/2026-06-04-phase1-scaffold-infra.md`

### Fase 2 — Agents + Providers + Skills
- Provider interface + implementacao claude-cli
- EmbeddingProvider interface (LLM-agnostic)
- CRUD de agents com hierarquia
- Cost tracking + hard-stop
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

### Fase 4 — Conversation Engine
- Conversation CRUD (criar, pausar, retomar, completar)
- Turn-based loop (orchestrator modera agentes)
- Message routing (@mentions, question_for_user, artifacts)
- Token efficiency: summary checkpoints + context window management
- WebSocket streaming de mensagens ao vivo
- Telas: ConversationView (aba no CardDetail), perguntas pendentes

### Fase 5 — Agent Memory + Error Learning
- Fachada AgentMemory sobre @claude-flow/memory
- EmbeddingProvider integrado com providers LLM
- Store/search/recall de memorias por tipo
- Session lifecycle (start/end/consolidate)
- Error detection (test failures, PR rejects, user corrections)
- Learning injection no prompt (memorias relevantes)
- Consolidacao periodica (merge duplicatas, promote patterns)
- Telas: AgentMemoryPage, Dashboard widgets

### Fase 6 — SDD
- Spec generation via conversa de agentes (nao mais single-agent)
- Spec review workflow (draft → review → approved)
- Versioning de specs
- Decomposicao: spec → cards no Kanban
- Telas: SpecStudio, SpecReview, SpecDetail

### Fase 7 — Executions
- Migrar orchestrator/session-manager para novo backend
- Integracao com cards (card → execution) e conversations
- Logs ao vivo via WebSocket
- PR creation
- Error learning integrado (registra erros durante execucao)
- Telas: ExecutionList, ExecutionDetail

### Fase 8 — Providers adicionais
- claude-api provider (Anthropic SDK)
- openai provider (OpenAI SDK)
- gemini provider (Google AI SDK)
- deepseek provider (OpenAI-compatible)
- cursor provider (Cursor CLI)
- Embedding providers para cada um
- Provider test connection

### Fase 9 — Polish + Deploy
- Dashboard com metricas (custos, learnings, error rate, conversations)
- Responsividade
- Error handling robusto
- Docker production build
- Documentacao
- Metricas de learning effectiveness
