# Prompt: Bug reporter automático + Tags nos cards

Duas mudanças independentes. Leia os arquivos referenciados antes de editar.

---

## Parte 1: Bug reporter é o usuário logado

Hoje o form de bug report pede nome/email manualmente. Deve usar o user logado automaticamente.

### 1a. Backend — `packages/api/src/routes/bug-reports.ts`

No endpoint `POST /api/bug-reports`, pegar nome e email do `req.user` (injetado pelo auth middleware) em vez de esperar nos fields do form:

```typescript
// Substituir:
reporterName: fields['reporterName'],
reporterEmail: fields['reporterEmail'],

// Por:
reporterName: (req as any).user?.name ?? fields['reporterName'] ?? null,
reporterEmail: (req as any).user?.email ?? fields['reporterEmail'] ?? null,
```

Isso usa o user logado como fallback prioritário, mas mantém compatibilidade com Slack/MCP que podem enviar nome/email próprios.

### 1b. Frontend — `packages/web/src/pages/BugReportPage.tsx`

**IMPORTANTE: essa página usa inline styles ao invés dos design tokens. Ao editá-la, migrar para Tailwind v4 com `[var(--color-*)]` syntax e usar componentes `Input`, `Textarea`, `Button`, `Badge` de `@/components/ui/`.**

Mudanças:
1. Remover os campos `reporterName` e `reporterEmail` do form (e seus states)
2. Remover esses campos do FormData no `handleSubmit`
3. O backend preenche automaticamente com o user logado
4. Migrar toda a página de inline styles para Tailwind + design tokens + componentes UI

Referência de estilo: ver `ExecutionListPage.tsx` ou `SpecReviewPage.tsx` para o padrão visual correto.

### 1c. Frontend — `packages/web/src/pages/BugReportDetailPage.tsx`

Verificar se mostra reporter_name — agora virá preenchido automaticamente. Nenhuma mudança funcional necessária, mas se usar inline styles, migrar para Tailwind também.

---

## Parte 2: Tags nos cards

Adicionar sistema de tags (labels) aos cards. Tags são strings livres com cor opcional.

### 2a. Migration — `packages/api/src/db/migrations/008_card_tags.sql`

```sql
CREATE TABLE IF NOT EXISTS card_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_tags_card ON card_tags(card_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_name ON card_tags(name);
```

### 2b. Backend — `packages/api/src/routes/cards.ts`

Adicionar endpoints:

```typescript
// Add tag to card
app.post<{ Params: { id: string } }>('/api/cards/:id/tags', { preHandler: [editorPlus] }, async (req, reply) => {
  const { name, color } = req.body as { name: string; color?: string }
  if (!name?.trim()) return reply.status(400).send({ error: 'Tag name is required' })
  const id = randomUUID()
  db.prepare('INSERT INTO card_tags (id, card_id, name, color) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, name.trim(), color ?? '#64748B')
  const tag = toCamelCase(db.prepare('SELECT * FROM card_tags WHERE id = ?').get(id) as any)
  return reply.status(201).send(tag)
})

// Remove tag from card
app.delete<{ Params: { id: string; tagId: string } }>('/api/cards/:id/tags/:tagId', { preHandler: [editorPlus] }, async (req, reply) => {
  db.prepare('DELETE FROM card_tags WHERE id = ? AND card_id = ?').run(req.params.tagId, req.params.id)
  return reply.status(204).send()
})
```

No GET `/api/cards/:id` (card detail), incluir tags na resposta:

```typescript
const tags = db.prepare('SELECT * FROM card_tags WHERE card_id = ? ORDER BY name').all(req.params.id)
// Adicionar ao response: tags: toCamelCaseArray(tags as any[])
```

### 2c. Shared types — `packages/shared/src/types/card.ts`

Adicionar:

```typescript
export interface CardTag {
  id: string
  cardId: string
  name: string
  color: string
  createdAt: string
}
```

Adicionar ao `CardWithDetails`:
```typescript
export interface CardWithDetails extends Card {
  repos: CardRepo[]
  comments: CardComment[]
  attachments: CardAttachment[]
  children: Card[]
  dependencies: CardDependency[]
  tags: CardTag[]  // NOVO
}
```

Exportar `CardTag` em `types/index.ts` se não for auto-exportado.

### 2d. API client — `packages/web/src/api/client.ts`

Adicionar ao objeto `cards`:

```typescript
addTag: (cardId: string, data: { name: string; color?: string }) =>
  request(`/cards/${cardId}/tags`, { method: 'POST', body: JSON.stringify(data) }),
removeTag: (cardId: string, tagId: string) =>
  request<void>(`/cards/${cardId}/tags/${tagId}`, { method: 'DELETE' }),
```

### 2e. Frontend — Componente `packages/web/src/components/cards/CardTags.tsx`

Novo componente para exibir e gerenciar tags no detalhe do card.

```tsx
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CardTag } from '@gaud/shared'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CardTagsProps {
  cardId: string
  tags: CardTag[]
  onUpdate: () => void
}

// Cores predefinidas para seleção rápida
const TAG_COLORS = [
  '#64748B', // slate
  '#2563EB', // blue
  '#059669', // green
  '#D97706', // amber
  '#DC2626', // red
  '#7C3AED', // violet
  '#DB2777', // pink
  '#0891B2', // cyan
]
```

UI:
- Lista de tags como pills coloridos (fundo com cor, texto branco, botão X para remover)
- Input para nova tag + seletor de cor (círculos coloridos clicáveis) + botão Add
- Estilo: `rounded-full px-2.5 py-0.5 text-xs font-medium text-white` com `bg` da cor da tag

### 2f. Frontend — Integrar no `packages/web/src/components/cards/CardDetail.tsx`

Importar `CardTags` e renderizar na seção de metadata do card (junto com repos, assigned agent, etc.):

```tsx
import { CardTags } from './CardTags'
// ...
<CardTags cardId={card.id} tags={card.tags ?? []} onUpdate={refreshCard} />
```

### 2g. Frontend — Tags no Kanban card — `packages/web/src/components/kanban/KanbanCard.tsx`

Mostrar as tags como mini-pills no card do Kanban:

```tsx
// Abaixo do título do card, se existirem tags:
{card.tags?.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {card.tags.map(tag => (
      <span
        key={tag.id}
        className="rounded-full px-1.5 py-px text-[10px] font-medium text-white"
        style={{ backgroundColor: tag.color }}
      >
        {tag.name}
      </span>
    ))}
  </div>
)}
```

Para isso, o endpoint `GET /api/boards/:id/cards` (que retorna cards para o Kanban) precisa incluir tags. No `packages/api/src/routes/cards.ts`, no endpoint que lista cards por board, fazer JOIN ou query separada para buscar tags de cada card.

### 2h. BackupService

Adicionar `card_tags` na lista de tabelas. Inserir na posição correta (após `card_attachments`).

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants com tokens
3. **Componentes UI**: usar `Button`, `Input`, `Modal`, `Badge` de `@/components/ui/`
4. **BugReportPage.tsx**: migrar de inline styles para Tailwind + design tokens
5. **DB síncrono**: better-sqlite3
6. **Tag colors**: usar `style={{ backgroundColor: tag.color }}` para cores dinâmicas (não Tailwind classes)

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Criar bug report — não pede nome/email, usa user logado automaticamente
2. Bug report list mostra nome do reporter preenchido
3. Card detail mostra seção de tags, pode adicionar com cor
4. Kanban cards mostram mini-pills de tags
5. Remover tag funciona
6. Backup inclui card_tags
