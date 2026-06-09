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

## 3. Board de bugs — fixo via migration, não aparece em /boards

O board de bugs é uma **estrutura fixa do sistema**, não um board criado pelo usuário. Tem ID constante, colunas com IDs constantes, e não aparece na listagem de boards.

### 3a. Constante — ID fixo do bug board

**Arquivo: `packages/shared/src/constants.ts`** (ou criar se não existir)

```typescript
export const BUG_BOARD_ID = 'bug-triage-board'
export const BUG_COLUMNS = {
  NEW: 'bug-col-new',
  TRIAGING: 'bug-col-triaging',
  TRIAGED: 'bug-col-triaged',
  IN_PROGRESS: 'bug-col-progress',
  TESTING: 'bug-col-testing',
  REOPENED: 'bug-col-reopened',
  DONE: 'bug-col-done',
} as const
```

Usar essas constantes em todo o código que referencia o bug board (frontend, backend, triage service).

### 3b. Migration — Criar board fixo

**Migration `packages/api/src/db/migrations/010_bug_board_fixed.sql`:**

```sql
-- Fixed Bug Triage board — system-managed, not user-created
INSERT OR IGNORE INTO boards (id, name) VALUES ('bug-triage-board', 'Bug Triage');
INSERT OR IGNORE INTO columns (id, board_id, name, color, position) VALUES
  ('bug-col-new', 'bug-triage-board', 'New', '#3B82F6', 0),
  ('bug-col-triaging', 'bug-triage-board', 'Triaging', '#F59E0B', 1),
  ('bug-col-triaged', 'bug-triage-board', 'Triaged', '#8B5CF6', 2),
  ('bug-col-progress', 'bug-triage-board', 'In Progress', '#06B6D4', 3),
  ('bug-col-testing', 'bug-triage-board', 'Testing', '#EC4899', 4),
  ('bug-col-reopened', 'bug-triage-board', 'Reopened', '#EF4444', 5),
  ('bug-col-done', 'bug-triage-board', 'Done', '#10B981', 6);
```

### 3c. Backend — Excluir bug board do GET /api/boards

**Arquivo: `packages/api/src/routes/boards.ts`**

```typescript
// De:
const boards = db.prepare('SELECT * FROM boards ORDER BY created_at').all()
// Para:
const boards = db.prepare("SELECT * FROM boards WHERE id != 'bug-triage-board' ORDER BY created_at").all()
```

Ou importar a constante:
```typescript
import { BUG_BOARD_ID } from '@gaud/shared'
const boards = db.prepare('SELECT * FROM boards WHERE id != ? ORDER BY created_at').all(BUG_BOARD_ID)
```

O board ainda é acessível via `GET /api/boards/:id` se necessário — só não aparece na listagem.

### 3d. Backend — Setup não cria mais o bug board

**Arquivo: `packages/api/src/routes/setup.ts`**

Remover a criação do board "Bug Triage" do setup (a migration já cria). Manter apenas o board "Development" no setup.

### 3e. Frontend — BugReportPage usa ID fixo

```typescript
import { BUG_BOARD_ID } from '@gaud/shared'

// Em vez de buscar por nome:
// api.boards.list().then(boards => boards.find(b => b.name === 'Bug Triage'))

// Buscar direto pelo ID:
fetchBoard(BUG_BOARD_ID)
fetchCards(BUG_BOARD_ID)
```

### 3f. Backend — bug-triage.ts usa ID fixo

```typescript
import { BUG_BOARD_ID, BUG_COLUMNS } from '@gaud/shared'

// Em vez de:
// const bugBoard = this.db.prepare("SELECT id FROM boards WHERE name = 'Bug Triage'").get()

// Usar direto:
this.createBugCard(reportId, BUG_BOARD_ID, BUG_COLUMNS.TRIAGED)
```

### 3g. Frontend — BugReportDetailPage "Move to Board"

No select de boards, a listagem de `api.boards.list()` já não inclui o bug board (filtrado no backend). Então o select só mostra boards de usuário (Development, etc).

### 3h. Limpar boards duplicados existentes

Para o banco atual que já tem boards "Bug Triage" criados via setup, a migration deve lidar com isso. Usar `INSERT OR IGNORE` garante idempotência. Opcionalmente, deletar o board duplicado criado pelo setup:

```sql
-- Delete setup-created Bug Triage board (if exists and differs from fixed ID)
DELETE FROM boards WHERE name = 'Bug Triage' AND id != 'bug-triage-board';
```

Mover cards órfãos para o board fixo se necessário.

## 4. API client updates

**Arquivo: `packages/web/src/api/client.ts`**

Adicionar:
```typescript
cards: {
  // ...existing
  moveToBoard: (cardId: string, data: { boardId: string; columnId: string }) =>
    request(`/cards/${cardId}/move-to-board`, { method: 'POST', body: JSON.stringify(data) }),
},
```

Não precisa de `listAll` — o bug board é buscado direto pelo ID fixo.

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
3. Bug triaged → card criado automaticamente no bug board fixo (coluna Triaged)
4. Na página do bug triaged → select de boards (só Development e outros)
5. "Move to Board" → card aparece no board Development
6. `/boards` NÃO mostra "Bug Triage"
7. `/bugs` mostra kanban do bug board fixo via ID constante
8. `BUG_BOARD_ID` e `BUG_COLUMNS` usados em todo o código (sem queries por nome)
