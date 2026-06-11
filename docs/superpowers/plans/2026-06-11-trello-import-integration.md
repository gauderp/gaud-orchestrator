# Trello Import Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar dados do Trello para o orquestrador em dois fluxos: (1) bugs — cards de listas configuradas viram bug reports na Triage; (2) atividades de dev — cards de um board Trello viram cards no Dev board, com mapeamento lista→coluna e sync contínuo de movimentos. **Import-only**: nada é escrito de volta no Trello.

**Arquitetura:** Uma tabela `trello_integrations` registra cada integração com credenciais da API Trello (key + token + secret), o board de origem, o target (`bugs` | `dev`) e o mapeamento de listas. Na criação: valida credenciais, registra o webhook **via API do Trello** e dispara backfill dos cards existentes. O webhook mantém o sync contínuo. Cards importados ganham `integration_id`/`external_id`/`external_url` para dedup e atualização idempotente.

**Spec:** `docs/superpowers/specs/2026-06-11-board-simplification-design.md` (extensão da Seção 4)

**Depende de:** Plano 2 (Pluggable Bug Sources) — já na main, incluindo `fastify-raw-body` registrado.

---

## Por que não usar o bug_sources/adapter trello existente

O adapter `trello` de `bug_sources` tem três limitações estruturais para uma integração real:

1. **HMAC com chave errada — nunca validaria payload real.** O Trello assina `x-trello-webhook` com HMAC-SHA1 usando o **API secret da aplicação** (o "OAuth Secret" associado à API key em trello.com/power-ups/admin), sobre `body + callbackURL`. O adapter atual usa nosso `webhook_secret` interno como chave — o Trello não conhece esse valor, então a verificação falharia com qualquer webhook real.
2. **Webhook do Trello é criado via API, não colado numa UI.** Não existe tela no Trello para cadastrar callback URL; é preciso `POST /1/tokens/{token}/webhooks` com credenciais — o que exige armazenar API key/token.
3. **Webhook não importa o passado.** Só eventos novos. "Importar dados do Trello" exige backfill via REST (`GET /1/boards/{id}/cards`).

**Decisão:** promover Trello a integração de primeira classe (`trello_integrations`). O type `trello` é **removido** de `bug_sources` (Task 7) — `bug_sources` permanece para push simples (generic, bugsnag). Sources `trello` existentes são desabilitadas na migration.

## Decisões de design (defaults — ajustar se Felipe discordar)

| Decisão | Default |
|---|---|
| Conflito de movimento (card movido localmente E no Trello) | Trello é fonte de verdade enquanto a integração está ativa — evento do Trello sobrescreve a coluna local, com comentário automático no card |
| Card arquivado/deletado no Trello | Card local **permanece** (import não destrutivo); comentário automático "Archived on Trello" |
| Card do Trello em lista não mapeada | Ignorado (target dev); para target bugs, só listas em `capture_list_ids` capturam |
| Rename/edição de descrição no Trello | Atualiza título/descrição do card local |
| Checklists nativas do Trello | Importadas como cards filhos (`parent_card_id`); item marcado → card filho na última coluna ("Done" ou equivalente) |
| Power-up Subtasks do Trello | Cards reais vinculados via attachment tipo `card` → detectados no backfill e linkados como `parent_card_id` |
| Membros, anexos, comentários, due dates do Trello | Fora de escopo nesta fase |
| Escrita de volta no Trello (two-way) | Fora de escopo — registrado como evolução futura |

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/api/src/db/migrations/013_trello_integrations.sql` | Tabela trello_integrations + colunas externas em cards + desabilitar bug_sources type trello |
| Create | `packages/shared/src/types/trello.ts` | TrelloIntegration, TrelloListMapping types |
| Create | `packages/api/src/services/trello-client.ts` | Cliente REST do Trello (validate, lists, cards, checklists, attachments, webhooks) |
| Create | `packages/api/src/services/trello-import.ts` | TrelloImportService: backfill + handleWebhookEvent (targets bugs/dev) |
| Create | `packages/api/src/routes/trello-integrations.ts` | CRUD + GET lists helper + POST backfill |
| Create | `packages/api/src/routes/trello-webhook.ts` | Endpoint público HEAD/GET/POST /api/intake/trello/:id |
| Create | `packages/api/src/__tests__/trello-client.test.ts` | Testes do cliente (fetch mockado) |
| Create | `packages/api/src/__tests__/trello-import.test.ts` | Testes do import service (payloads reais de exemplo) |
| Modify | `packages/api/src/middleware/auth.ts` | PUBLIC_ROUTES += intake/trello |
| Modify | `packages/api/src/index.ts` | Registrar as 2 rotas novas |
| Modify | `packages/api/src/intake/registry.ts` | Remover trelloAdapter |
| Delete | `packages/api/src/intake/adapters/trello.ts` | Substituído pela integração de primeira classe |
| Modify | `packages/api/src/__tests__/adapters.test.ts` | Remover bloco trelloAdapter |
| Modify | `packages/web/src/pages/BugSourcesPage.tsx` | Remover trello do SOURCE_TYPES; link para a página nova |
| Create | `packages/web/src/pages/TrelloIntegrationsPage.tsx` | Wizard de criação + lista de integrações |
| Modify | `packages/web/src/components/cards/CardDetail.tsx` | Seção de subtasks (cards filhos) + link ao pai |
| Modify | `packages/web/src/api/client.ts` | Métodos trelloIntegrations |
| Modify | `packages/web/src/App.tsx` | Rota /settings/trello |
| Modify | `packages/web/src/components/*Card*` | Badge Trello quando card tem externalUrl |

**Padrões obrigatórios do codebase** (causaram retrabalho nos planos 1 e 2 — seguir à risca):
- Rotas: `export async function xRoutes(app)` com `const db = (app as any).db ?? (await import('../db/connection.js')).getDb()` — NUNCA `getDb()` direto no escopo do plugin.
- Respostas sempre via `toCamelCase`/`toCamelCaseArray` de `../utils/case.js`.
- Imports ESM com extensão `.js`.
- Mutações com `requireRole('editor')`; credenciais visíveis só para admin.
- Rodar `pnpm -r test` (não só typecheck) antes de declarar qualquer task concluída.

---

### Task 1: Migration 013

**Files:** Create `packages/api/src/db/migrations/013_trello_integrations.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Migration 013: Trello integrations (import-only)

CREATE TABLE trello_integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('bugs', 'dev')),
  trello_board_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_token TEXT NOT NULL,
  api_secret TEXT,                     -- OAuth secret da API key; usado no HMAC do webhook (opcional mas recomendado)
  -- target 'dev': { "listMapping": { "<trelloListId>": "<devColumnId>" } }
  -- target 'bugs': { "captureListIds": ["<trelloListId>", ...] }
  config_json TEXT NOT NULL DEFAULT '{}',
  webhook_secret TEXT NOT NULL,        -- token nosso na query string da callback URL
  trello_webhook_id TEXT,              -- id retornado pelo Trello ao registrar o webhook
  enabled INTEGER NOT NULL DEFAULT 1,
  last_backfill_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cards importados: rastreio de origem para dedup e sync
ALTER TABLE cards ADD COLUMN integration_id TEXT REFERENCES trello_integrations(id);
ALTER TABLE cards ADD COLUMN external_id TEXT;
ALTER TABLE cards ADD COLUMN external_url TEXT;

CREATE UNIQUE INDEX idx_cards_external
  ON cards(integration_id, external_id)
  WHERE external_id IS NOT NULL;

-- bug_sources type 'trello' é substituído por esta integração
UPDATE bug_sources SET enabled = 0 WHERE type = 'trello';
```

- [ ] **Step 2: Verificar** — subir o servidor, conferir `Migration applied: 013` e backup `.bak` criado automaticamente.
- [ ] **Step 3: Commit**

---

### Task 2: Shared Types

**Files:** Create `packages/shared/src/types/trello.ts`; Modify `packages/shared/src/types/card.ts` (ou onde `Card` estiver) e o barrel export.

- [ ] **Step 1:**

```typescript
export type TrelloTarget = 'bugs' | 'dev'

export interface TrelloIntegration {
  id: string
  name: string
  target: TrelloTarget
  trelloBoardId: string
  apiKey: string
  apiToken: string        // só retornado para admin
  apiSecret: string | null
  configJson: string
  webhookSecret: string
  trelloWebhookId: string | null
  enabled: boolean
  lastBackfillAt: string | null
  createdAt: string
}

export interface TrelloList {
  id: string
  name: string
}
```

- [ ] **Step 2:** Adicionar a `Card`: `integrationId: string | null`, `externalId: string | null`, `externalUrl: string | null`.
- [ ] **Step 3:** Typecheck do shared + commit.

---

### Task 3: TrelloClient (REST)

**Files:** Create `packages/api/src/services/trello-client.ts` + `packages/api/src/__tests__/trello-client.test.ts`

- [ ] **Step 1: Testes primeiro** (fetch mockado via `vi.stubGlobal('fetch', ...)`): validateCredentials ok/401, getLists, getCards, getChecklists, getAttachments, createWebhook, deleteWebhook.
- [ ] **Step 2: Implementar.** Base `https://api.trello.com/1`, autenticação por query `key` + `token`:

```typescript
export class TrelloClient {
  constructor(private apiKey: string, private apiToken: string) {}
  private url(path: string, params: Record<string, string> = {}): string { /* monta query com key/token */ }

  async validateCredentials(): Promise<boolean>            // GET /members/me → 200?
  async getBoard(boardId: string): Promise<{ id: string; name: string }>  // GET /boards/{id}
  async getLists(boardId: string): Promise<TrelloList[]>   // GET /boards/{id}/lists
  async getCards(boardId: string): Promise<TrelloCardRaw[]> // GET /boards/{id}/cards (open) — inclui idList, name, desc, shortUrl, closed
  async getChecklists(cardId: string): Promise<TrelloChecklist[]>  // GET /cards/{id}/checklists → { id, name, checkItems: [{ name, state }] }
  async getAttachments(cardId: string): Promise<TrelloAttachment[]> // GET /cards/{id}/attachments → detectar type 'card' para power-up subtasks
  async createWebhook(callbackURL: string, idModel: string): Promise<string>  // POST /webhooks → retorna webhook id
  async deleteWebhook(webhookId: string): Promise<void>    // DELETE /webhooks/{id}
}
```

Notas: o `createWebhook` do Trello dispara um `HEAD` na callbackURL na hora do registro — a rota pública (Task 6) precisa existir antes de qualquer teste real. Rate limit do Trello: 300 req/10s por key — um `GET /boards/{id}/cards` único já traz todos os cards abertos, sem paginação manual.

**Subtasks — dois mecanismos:**
- **Checklists nativas:** `GET /cards/{id}/checklists` retorna `checkItems[].name` e `checkItems[].state` ('complete'/'incomplete'). Cada item vira card filho.
- **Power-up Subtasks:** cria cards reais no mesmo board e vincula via attachment do tipo `card` (campo `url` contém o shortUrl do card filho). `GET /cards/{id}/attachments` com filtro `attachment.url` que match `trello.com/c/` detecta esses vínculos.

- [ ] **Step 3:** Testes verdes + commit.

---

### Task 4: TrelloImportService

**Files:** Create `packages/api/src/services/trello-import.ts` + `packages/api/src/__tests__/trello-import.test.ts`

Serviço com banco injetado no construtor (testável com `createTestDb()` — helper já existente em `__tests__/helpers/test-db.ts`).

- [ ] **Step 1: Testes primeiro**, usando `createTestDb()` e payloads de webhook reais de exemplo:
  - `importCard` target dev: cria card na coluna mapeada; segundo import do mesmo external_id atualiza em vez de duplicar.
  - `importCard` target bugs: cria bug_report + card em Triage: New + conversa (mesmo fluxo do intake existente).
  - `handleWebhookEvent` createCard (lista mapeada) → cria; (lista não mapeada) → ignora.
  - `handleWebhookEvent` updateCard com `data.listAfter` → move card local + comentário automático.
  - `handleWebhookEvent` updateCard rename/desc → atualiza campos.
  - `handleWebhookEvent` updateCard com `data.card.closed = true` → card permanece, comentário "Archived on Trello".
  - `backfill` → importa todos os cards abertos das listas mapeadas/capturadas, idempotente (rodar 2x não duplica).
  - `importChecklists` → card com 2 checklists (3 items cada) → cria 6 cards filhos com `parent_card_id`; item com state='complete' → card filho na última coluna do board; rodar 2x não duplica (dedup por `external_id` = `checklist:{checkItemId}`).
  - `importSubtaskLinks` → card com attachment tipo card apontando para outro card do mesmo board → seta `parent_card_id` no card filho já importado; attachment apontando para card de outro board → ignorado.

- [ ] **Step 2: Implementar:**

```typescript
export class TrelloImportService {
  constructor(private db: Database.Database) {}

  // Importa/atualiza um card do Trello. Retorna 'created' | 'updated' | 'ignored'.
  importCard(integration: TrelloIntegrationRow, trelloCard: TrelloCardRaw): ImportResult

  // Despacha eventos do webhook: createCard, updateCard (move/rename/archive)
  handleWebhookEvent(integration: TrelloIntegrationRow, payload: unknown): ImportResult

  // Importa checklists de um card como cards filhos
  async importChecklists(integration: TrelloIntegrationRow, parentCardId: string, trelloCardId: string, client: TrelloClient): Promise<{ created: number; updated: number }>

  // Detecta power-up subtask links (attachments tipo card) e seta parent_card_id
  async linkSubtasks(integration: TrelloIntegrationRow, trelloCardId: string, localCardId: string, client: TrelloClient): Promise<number>

  // Importa todos os cards abertos do board (chama TrelloClient.getCards) + checklists + subtask links
  async backfill(integration: TrelloIntegrationRow, client: TrelloClient): Promise<{ created: number; updated: number; ignored: number; subtasksLinked: number }>
}
```

Regras:
- **Dedup SEMPRE via `cards(integration_id, external_id)`** — para ambos os targets. ATENÇÃO (target bugs): `bug_reports.source_id` tem FK para `bug_sources`, NÃO para `trello_integrations` — não usar `bug_reports(source_id, external_id)` para dedup nem tentar gravar o id da integração em `source_id` (violaria a FK). O fluxo correto: card criado em Triage: New carrega `integration_id`/`external_id`/`external_url`; o bug_report é criado com `source = 'trello'`, `source_id = NULL`, `external_id`/`external_url` preenchidos (campos informativos) e linkado via `card_id`. No reimport/backfill: buscar card por `(integration_id, external_id)` → se existe, atualizar descrição do bug_report via `card_id` e retornar 'updated'.
- **Target dev:** coluna destino = `configJson.listMapping[idList]`; sem mapeamento → `ignored`. Card criado com `type='task'`, posição = MAX(position)+1 na coluna.
- **Target bugs:** lista em `configJson.captureListIds` → cria via fluxo de bug report (replicar o que `intake.ts` faz: conversation + card Triage New + bug_report com external_id). Reusar/extrair função compartilhada se trivial; senão duplicar consciente (são ~20 linhas).
- **Checklists → cards filhos:** após importar um card, chamar `importChecklists`. Cada checkItem vira um card filho: `title` = item name, `type` = 'task', `parent_card_id` = card local pai, `external_id` = `checklist:{checkItemId}` (para dedup). Item com `state='complete'` → card criado na última coluna do board (Done/equivalente); `state='incomplete'` → mesma coluna do pai.
- **Power-up Subtask links:** após importar TODOS os cards do board, chamar `linkSubtasks` para cada card. Busca attachments do tipo card (URL match `trello.com/c/`); extrai o shortId do card filho; busca o card local com `external_id` correspondente; se encontrado e no mesmo integration_id → seta `parent_card_id`. Ordem: backfill primeiro importa todos os cards flat, depois resolve os links pai→filho numa segunda passada.
- **Move (dev):** comentário automático `author_type='system'`: "Moved on Trello: <listBefore> → <listAfter>". `broadcast('card:moved', ...)`.
- Import-only: nenhuma chamada de escrita ao Trello aqui.

- [ ] **Step 3:** Testes verdes + commit.

---

### Task 5: Rotas CRUD

**Files:** Create `packages/api/src/routes/trello-integrations.ts`

- [ ] **Step 1:** Implementar (padrões: db injetado, toCamelCase, requireRole):
  - `GET /api/trello-integrations` — lista; **mascarar** `api_token`/`api_secret` para não-admin (`token: '•••' `).
  - `POST /api/trello-integrations` (editor+) — body: name, target, trelloBoardId, apiKey, apiToken, apiSecret?, configJson. Fluxo: valida credenciais via `TrelloClient.validateCredentials()` (400 se inválidas) → gera `webhook_secret` (crypto.randomBytes 32 hex) → INSERT → registra webhook no Trello (`createWebhook` com callbackURL `${PUBLIC_BASE_URL}/api/intake/trello/{id}?token={webhook_secret}`) → salva `trello_webhook_id` → dispara `backfill` em background (não bloquear resposta; logar erro). `PUBLIC_BASE_URL` = env var nova (documentar no .env.example se existir).
  - `GET /api/trello-integrations/lists?apiKey=&apiToken=&boardId=` (editor+) — helper para a UI montar o mapeamento antes de criar.
  - `POST /api/trello-integrations/:id/backfill` (editor+) — reimport manual; atualiza `last_backfill_at`; retorna contadores.
  - `PUT /api/trello-integrations/:id` (editor+) — toggle `enabled` e edição de `config_json`.
  - `DELETE /api/trello-integrations/:id` (admin) — tenta `deleteWebhook` no Trello (best-effort, não falhar se 404) e deleta a linha. Cards importados permanecem.
- [ ] **Step 2:** Registrar em `index.ts`. Typecheck + commit.

---

### Task 6: Webhook público

**Files:** Create `packages/api/src/routes/trello-webhook.ts`; Modify `middleware/auth.ts`, `index.ts`

- [ ] **Step 1:** Rota:
  - `HEAD|GET /api/intake/trello/:integrationId` → 200 (validação de registro do Trello).
  - `POST /api/intake/trello/:integrationId?token=...` com `{ config: { rawBody: true } }`:
    1. Busca integração `enabled = 1` (404 se não).
    2. Valida `token` vs `webhook_secret` — guarda de length + `timingSafeEqual` em try/catch (padrão de `intake.ts`).
    3. **Se `api_secret` configurado**: valida HMAC-SHA1 base64 de `rawBody + callbackURL` contra header `x-trello-webhook`, usando `api_secret` como chave (callbackURL reconstruída com `PUBLIC_BASE_URL` se setada, senão `req.protocol://req.hostname + req.url` — trustProxy já está habilitado). Sem `api_secret`, o token da URL é a única autenticação (aceitável: é secret de 64 hex chars).
    4. `TrelloImportService.handleWebhookEvent(integration, req.body)` → 200 com o resultado.
- [ ] **Step 2:** `PUBLIC_ROUTES` += `'POST /api/intake/trello/'`, `'HEAD /api/intake/trello/'`, `'GET /api/intake/trello/'`.
- [ ] **Step 3:** Registrar em `index.ts`. Commit.

---

### Task 7: Remover trello de bug_sources

**Files:** Delete `intake/adapters/trello.ts`; Modify `intake/registry.ts`, `__tests__/adapters.test.ts`, `web/src/pages/BugSourcesPage.tsx`

- [ ] **Step 1:** Remover registro/arquivo do adapter; remover bloco de testes do trelloAdapter; remover entry `trello` de `SOURCE_TYPES` na página, com nota apontando para `/settings/trello`.
- [ ] **Step 2:** `grep -r "trelloAdapter" packages/` → 0 resultados. `pnpm -r test` verde. Commit.

---

### Task 8: Frontend — página de integrações

**Files:** Create `packages/web/src/pages/TrelloIntegrationsPage.tsx`; Modify `api/client.ts`, `App.tsx`

- [ ] **Step 1:** Métodos no client: `trelloIntegrations.list/create/update/delete/backfill/getLists`.
- [ ] **Step 2:** Página `/settings/trello` no padrão visual da BugSourcesPage:
  - Lista: nome, target (badge), board, status do webhook (registrado/falhou), enabled toggle, botão "Backfill now" com contadores no resultado, delete com confirm.
  - Criação em 3 passos no mesmo modal: (1) credenciais (apiKey/apiToken/apiSecret opcional + link "como obter" para trello.com/power-ups/admin) e boardId; (2) botão "Load lists" → chama `getLists`; (3) para target `dev`, um select de coluna do Dev board por lista do Trello (com opção "Ignore"); para target `bugs`, checkboxes das listas a capturar.
- [ ] **Step 3:** Rota em App.tsx + link na navegação de settings. Typecheck + commit.

---

### Task 9: Badge Trello nos cards

**Files:** componente de card do board (localizar via grep por onde `Card` é renderizado no kanban) e/ou CardDetailPage

- [ ] **Step 1:** Quando `card.externalUrl` existir, exibir badge/ícone discreto que abre o link do Trello em nova aba. Tooltip: "Imported from Trello".
- [ ] **Step 2:** Commit.

---

### Task 10: UI de subtasks no CardDetail

**Files:** Modify `packages/web/src/components/cards/CardDetail.tsx`

O backend já suporta `parent_card_id` e `children: Card[]` em `CardWithDetails` — falta a UI.

- [ ] **Step 1:** No CardDetail, quando `card.parentCardId` existir, exibir link clicável ao card pai no topo (abaixo do título): "↑ Subtask of: {parentCard.title}".
- [ ] **Step 2:** Quando `card.children.length > 0`, exibir seção "Subtasks" com lista dos filhos: título (link), coluna atual, badge de status. Estilo: lista compacta similar à seção de dependências.
- [ ] **Step 3:** No kanban, cards que têm filhos exibem badge discreto com contagem: "(3 subtasks)".
- [ ] **Step 4:** Typecheck + commit.

---

### Task 11: Verificação integrada

- [ ] **Step 1:** `pnpm -r typecheck` e `pnpm -r test` — tudo verde (ressalva conhecida: providers.test.ts é flaky sob carga; rerodar isolado).
- [ ] **Step 2:** Smoke local sem Trello real: inserir integração fake target dev no banco, POST no webhook com payload `createCard` de exemplo → card aparece no Dev: coluna mapeada; repetir POST → não duplica; payload `updateCard` com listAfter → card move + comentário. Verificar que cards filhos (de checklists) aparecem como subtasks no CardDetail.
- [ ] **Step 3:** Smoke com Trello real (manual, requer credenciais de Felipe): criar integração apontando para um board de teste, conferir backfill, criar card no Trello → aparece no orquestrador, mover no Trello → move aqui. **Atenção:** callback URL precisa ser acessível pela internet (PUBLIC_BASE_URL via túnel — cloudflared/ngrok — se rodando local).
- [ ] **Step 4:** Commit final de ajustes.

---

## Evoluções futuras (registrar, não implementar)

- Two-way sync (mover card aqui → mover no Trello) — exige lock anti-eco de eventos.
- Importar membros do Trello → assigned_agent/usuário; anexos; due dates; comentários.
- Sync contínuo de checklists via webhook (addChecklistToCard, updateCheckItem events) — atualmente só no backfill.
- Polling de reconciliação periódica (webhook perdido = card dessincronizado até o próximo evento).
