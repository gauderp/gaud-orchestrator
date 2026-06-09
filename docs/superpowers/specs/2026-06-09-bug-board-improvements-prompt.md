# Prompt: Melhorias no fluxo de bugs — chat contínuo, board linkado, board oculto

Três mudanças:
1. Chat com IA disponível nas fases New e Triaging (não só após triage)
2. Na fase Triaged, opção de vincular/mover o card para outro board (ex: Development)
3. Board "Bug Triage" não aparece em `/boards` — é exclusivo da página `/bugs`

Leia os arquivos referenciados antes de editar.

## 1. Chat contínuo nas fases New e Triaging

Hoje a conversa só aparece após o triage ser disparado (quando `conversationId` existe). Precisamos que o usuário possa conversar com a IA desde o início.

### 1a. Backend — Criar conversa ao criar bug report

**Arquivo: `packages/api/src/routes/bug-reports.ts`**

No endpoint `POST /api/bug-reports`, após criar o bug report, criar automaticamente uma conversa vazia:

```typescript
// Após inserir o bug report no DB:
const convId = randomUUID()
const now = new Date().toISOString()
db.prepare('INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, ?, ?, ?)').run(convId, 'research', now, now)
db.prepare('UPDATE bug_reports SET conversation_id = ? WHERE id = ?').run(convId, reportId)
```

Não adicionar participante ainda — o agent é adicionado quando o user clica "Start Triage".

### 1b. Backend — Endpoint para user enviar mensagem na conversa do bug

O user deve poder enviar mensagens na conversa do bug a qualquer momento (não só via respond).

O endpoint existente `POST /api/conversations/:id/messages` já aceita mensagens do user. Verificar que funciona quando a conversa não tem participants (agent). Se o user enviar mensagem antes do triage, ela fica armazenada como contexto adicional para quando o agent entrar.

### 1c. Frontend — `BugReportDetailPage.tsx`

A seção da conversa deve aparecer **SEMPRE** (não só quando `conversationId && activeConversation`):

- **Fase New**: mostra conversa com input para o user adicionar contexto + botão "Start Triage" no header da conversa
- **Fase Triaging**: mostra conversa com typing indicator do agent + mensagens em tempo real
- **Fase needs_info**: mostra conversa com opções/input para responder
- **Fase Triaged**: mostra conversa (read-only ou continuável) + ação de vincular a board

O `Start Triage` passa de bloco separado para um botão no header da conversa (ao lado do título "Conversation").

### 1d. Frontend — ConversationView com estado vazio

Se a conversa existe mas não tem mensagens e não tem participants, mostrar:
- Input para o user digitar (adicionar contexto)
- Mensagem: "Adicione contexto ou clique em Start Triage para iniciar a análise com IA"

## 2. Na fase Triaged — vincular a outro board

### 2a. Frontend — `BugReportDetailPage.tsx`

Quando `report.status === 'triaged'`, mostrar ação para vincular o card a outro board:

```tsx
{report.status === 'triaged' && report.cardId && (
  <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
    <h3 className="text-sm font-semibold mb-2 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
      Assign to Development
    </h3>
    <p className="text-xs text-[var(--color-muted)] mb-3">
      Move this bug to a development board for a developer to work on.
    </p>
    <div className="flex items-center gap-2">
      <select board...>
        {boards que NÃO são "Bug Triage"}
      </select>
      <select column...>
      </select>
      <Button>Move to Board</Button>
    </div>
  </div>
)}
```

### 2b. Backend — Endpoint para mover card entre boards

**Arquivo: `packages/api/src/routes/cards.ts`**

Adicionar endpoint ou modificar o PUT `/api/cards/:id` para aceitar mudança de `board_id`:

```typescript
// PUT /api/cards/:id com body { boardId, columnId }
// Atualiza board_id e column_id do card
```

Ou criar endpoint específico:
```typescript
// POST /api/cards/:id/move-to-board
// body: { boardId, columnId }
```

## 3. Board "Bug Triage" oculto do /boards

### 3a. Database — Flag `internal` no board

**Migration `packages/api/src/db/migrations/010_board_internal.sql`:**

```sql
ALTER TABLE boards ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
```

### 3b. Board de bugs — fixo via migration OU criado no setup

O board "Bug Triage" deve existir sempre. Duas estratégias (implementar ambas como fallback):

**Via migration `010_board_internal.sql`** — criar o board fixo se não existir:

```sql
ALTER TABLE boards ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;

-- Create Bug Triage board if not exists (idempotent)
INSERT OR IGNORE INTO boards (id, name, internal) VALUES ('bug-triage-board', 'Bug Triage', 1);
INSERT OR IGNORE INTO columns (id, board_id, name, color, position) VALUES
  ('bug-col-new', 'bug-triage-board', 'New', '#3B82F6', 0),
  ('bug-col-triaging', 'bug-triage-board', 'Triaging', '#F59E0B', 1),
  ('bug-col-triaged', 'bug-triage-board', 'Triaged', '#8B5CF6', 2),
  ('bug-col-progress', 'bug-triage-board', 'In Progress', '#06B6D4', 3),
  ('bug-col-testing', 'bug-triage-board', 'Testing', '#EC4899', 4),
  ('bug-col-reopened', 'bug-triage-board', 'Reopened', '#EF4444', 5),
  ('bug-col-done', 'bug-triage-board', 'Done', '#10B981', 6);
```

**Via setup** — se o setup já cria o board, marcá-lo como `internal = 1`:

```typescript
db.prepare('INSERT INTO boards (id, name, internal) VALUES (?, ?, 1)').run(bugBoardId, 'Bug Triage')
```

**Fallback**: no código que busca o bug board (`BugReportPage`, `bug-triage.ts`), usar `WHERE name = 'Bug Triage'` — funciona independente de como foi criado.

O board "Development" continua com `internal = 0`.

### 3c. Backend — `/api/boards` filtra boards internos

**Arquivo: `packages/api/src/routes/boards.ts`**

No `GET /api/boards`, filtrar boards com `internal = 0`:

```typescript
// De:
const boards = db.prepare('SELECT * FROM boards ORDER BY created_at').all()
// Para:
const boards = db.prepare('SELECT * FROM boards WHERE internal = 0 ORDER BY created_at').all()
```

Adicionar query param opcional `?includeInternal=true` para uso interno (ex: BugReportPage precisa buscar o bug board):

```typescript
app.get('/api/boards', async (req, reply) => {
  const includeInternal = (req.query as any).includeInternal === 'true'
  const sql = includeInternal
    ? 'SELECT * FROM boards ORDER BY created_at'
    : 'SELECT * FROM boards WHERE internal = 0 ORDER BY created_at'
  const boards = db.prepare(sql).all()
  return reply.send(toCamelCaseArray(boards as any[]))
})
```

### 3d. Frontend — BugReportPage busca board internal

Na `BugReportPage.tsx`, buscar o board "Bug Triage" usando `?includeInternal=true`:

```typescript
// Mudar de:
api.boards.list()
// Para:
fetch('/api/boards?includeInternal=true').then(r => r.json())
// Ou adicionar ao api client:
api.boards.listAll()
```

### 3e. Frontend — BugReportDetailPage filtra boards internos no select de "Move to Board"

No select de boards para vincular, mostrar apenas boards NÃO internos:

```typescript
const visibleBoards = boards.filter(b => !b.internal)
```

### 3f. Shared types — Adicionar `internal` ao Board

**Arquivo: `packages/shared/src/types/board.ts`**

Adicionar campo:
```typescript
export interface Board {
  // ...existing
  internal?: boolean
}
```

### 3g. Marcar board existente como internal

Para o banco atual, rodar:
```sql
UPDATE boards SET internal = 1 WHERE name = 'Bug Triage';
```

### 3h. BackupService

`card_tags` já foi adicionado. O campo `internal` da tabela `boards` é incluído automaticamente no dump.

## 4. API client updates

**Arquivo: `packages/web/src/api/client.ts`**

Adicionar:
```typescript
boards: {
  // ...existing
  listAll: () => request<Board[]>('/boards?includeInternal=true'),
},
cards: {
  // ...existing
  moveToBoard: (cardId: string, data: { boardId: string; columnId: string }) =>
    request(`/cards/${cardId}/move-to-board`, { method: 'POST', body: JSON.stringify(data) }),
},
```

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **Componentes UI**: usar `Button`, `Input`, `Badge`, `Modal` de `@/components/ui/`
4. **Board internal**: flag boolean na tabela, filtrada no GET padrão, incluída com query param
5. **Conversa criada junto com o bug**: não depende mais do Start Triage para existir
6. **Start Triage move para header da conversa**: não é mais um bloco separado

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Criar bug → conversa inline aparece imediatamente → user pode digitar contexto
2. Start Triage no header da conversa → agent entra e responde
3. Bug triaged → card criado no Bug Triage board (oculto do /boards)
4. Na página do bug triaged → select de boards (só mostra Development e outros, não Bug Triage)
5. "Move to Board" → card aparece no board Development
6. `/boards` não mostra "Bug Triage"
7. `/bugs` mostra kanban do Bug Triage normalmente
