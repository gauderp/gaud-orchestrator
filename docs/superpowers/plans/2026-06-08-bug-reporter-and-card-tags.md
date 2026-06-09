# Bug Reporter Auto-Fill + Card Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill bug reporter from logged-in user instead of manual form fields, and add a tag system to cards with full CRUD + Kanban display.

**Architecture:** Two independent features. Part 1 modifies the bug report POST endpoint to read `req.user` (already injected by auth middleware at line 64 of `auth.ts`) and removes reporter fields from the frontend form while migrating BugReportPage from inline styles to Tailwind + design tokens. Part 2 adds a `card_tags` table, API endpoints, shared types, and frontend components (CardTags manager + KanbanCard mini-pills).

**Tech Stack:** Fastify, better-sqlite3, React, Tailwind CSS v4 with `[var(--color-*)]` tokens, lucide-react icons, `@/components/ui/*` design system.

---

### Task 1: Backend — Auto-fill bug reporter from logged-in user

**Files:**
- Modify: `packages/api/src/routes/bug-reports.ts:57-64`

- [ ] **Step 1: Update POST /api/bug-reports to use req.user**

In `packages/api/src/routes/bug-reports.ts`, replace lines 57-64:

```typescript
    // OLD:
    const report = triage.createReport({
      title: fields['title'],
      description: fields['description'],
      reporterName: fields['reporterName'],
      reporterEmail: fields['reporterEmail'],
      source: fields['source'] as any ?? 'ui',
      attachments,
    })

    // NEW:
    const user = (req as any).user as { id: string; name: string; email: string; role: string } | undefined
    const report = triage.createReport({
      title: fields['title'],
      description: fields['description'],
      reporterName: user?.name ?? fields['reporterName'] ?? null,
      reporterEmail: user?.email ?? fields['reporterEmail'] ?? null,
      source: fields['source'] as any ?? 'ui',
      attachments,
    })
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @gaud/api typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/bug-reports.ts
git commit -m "feat: auto-fill bug reporter name/email from logged-in user"
```

---

### Task 2: Frontend — Remove reporter fields and migrate BugReportPage to Tailwind

**Files:**
- Modify: `packages/web/src/pages/BugReportPage.tsx`

- [ ] **Step 1: Rewrite BugReportPage.tsx with Tailwind + design tokens + UI components**

Replace the entire file content with:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Plus, Upload, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Clock } from 'lucide-react'
import type { BugReport } from '@gaud/shared'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'error' | 'neutral'; icon: any }> = {
  new: { label: 'New', variant: 'info', icon: Clock },
  triaging: { label: 'Triaging', variant: 'warning', icon: Clock },
  needs_info: { label: 'Needs Info', variant: 'warning', icon: HelpCircle },
  triaged: { label: 'Triaged', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', variant: 'error', icon: XCircle },
}

const severityConfig: Record<string, { variant: 'error' | 'warning' | 'info' | 'neutral' }> = {
  critical: { variant: 'error' },
  high: { variant: 'warning' },
  medium: { variant: 'warning' },
  low: { variant: 'info' },
}

type TabStatus = 'all' | 'new' | 'needs_info' | 'triaged' | 'rejected'

export function BugReportPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [tab, setTab] = useState<TabStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // Form fields — reporter name/email removed (auto-filled by backend from logged-in user)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadReports() }, [tab])

  async function loadReports() {
    try {
      const result = await api.bugReports.list(tab === 'all' ? undefined : tab)
      setReports(result)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      for (const file of files) {
        formData.append('files', file)
      }
      await api.bugReports.create(formData)
      setTitle('')
      setDescription('')
      setFiles([])
      setShowForm(false)
      await loadReports()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { key: TabStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'needs_info', label: 'Needs Info' },
    { key: 'triaged', label: 'Triaged' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Bug size={20} className="text-[var(--color-destructive)]" />
          <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Bug Reports</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" variant="destructive">
          <Plus size={14} className="mr-1.5" />
          Report Bug
        </Button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/5 px-3.5 py-2.5 mb-4 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      {/* Submit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-4">New Bug Report</h2>

          <div className="flex flex-col gap-3">
            <Input
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief summary of the bug"
              required
            />

            <Textarea
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What happened? What did you expect? Steps to reproduce..."
              required
              rows={6}
              className="min-h-[100px]"
            />

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Attachments</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={e => setFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] px-3.5 py-2 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] cursor-pointer hover:border-[var(--color-muted)] dark:hover:border-[var(--color-muted-dark)]"
              >
                <Upload size={14} />
                Upload screenshots, logs, videos...
              </button>
              {files.length > 0 && (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {files.map((f, i) => (
                    <Badge key={i} variant="neutral">{f.name}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                loading={submitting}
                disabled={!title.trim() || !description.trim()}
              >
                Submit Report
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium cursor-pointer transition-colors ${
              tab === t.key
                ? 'border-[var(--color-destructive)] text-[var(--color-destructive)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report List */}
      {reports.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] text-center py-10">
          No bug reports{tab !== 'all' ? ` with status "${tab}"` : ''}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map(report => {
            const status = statusConfig[report.status] ?? statusConfig['new']!
            const severity = report.severity ? severityConfig[report.severity] : null
            const StatusIcon = status.icon
            return (
              <div
                key={report.id}
                onClick={() => navigate(`/bugs/${report.id}`)}
                className="flex items-center justify-between px-4 py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] cursor-pointer transition-colors hover:border-[var(--color-muted)] dark:hover:border-[var(--color-muted-dark)]"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[var(--color-destructive)] shrink-0" />
                    <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate">
                      {report.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                    {report.reporterName && <span>{report.reporterName}</span>}
                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    {report.source !== 'ui' && <Badge variant="neutral">{report.source}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {severity && (
                    <Badge variant={severity.variant}>{report.severity}</Badge>
                  )}
                  <Badge variant={status.variant}>
                    <StatusIcon size={12} className="mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/BugReportPage.tsx
git commit -m "feat: remove reporter fields from bug form, migrate to Tailwind + design tokens"
```

---

### Task 3: Migration — Create card_tags table

**Files:**
- Create: `packages/api/src/db/migrations/008_card_tags.sql`

- [ ] **Step 1: Create the migration file**

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

- [ ] **Step 2: Verify migration runs**

Run: `pnpm --filter @gaud/api typecheck`
Expected: 0 errors (migration is SQL, just verify no build issues)

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/migrations/008_card_tags.sql
git commit -m "feat: add card_tags migration"
```

---

### Task 4: Shared types — Add CardTag

**Files:**
- Modify: `packages/shared/src/types/card.ts`

- [ ] **Step 1: Add CardTag interface and update CardWithDetails**

In `packages/shared/src/types/card.ts`, add `CardTag` interface after `CardAttachment` (after line 57):

```typescript
export interface CardTag {
  id: string
  cardId: string
  name: string
  color: string
  createdAt: string
}
```

Then update `CardWithDetails` (line 27-33) to include tags:

```typescript
export interface CardWithDetails extends Card {
  repos: CardRepo[]
  comments: CardComment[]
  attachments: CardAttachment[]
  children: Card[]
  dependencies: CardDependency[]
  tags: CardTag[]
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/shared typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/card.ts
git commit -m "feat: add CardTag type and include in CardWithDetails"
```

---

### Task 5: Backend — Tag CRUD endpoints + include tags in card responses

**Files:**
- Modify: `packages/api/src/routes/cards.ts`

- [ ] **Step 1: Add tags to GET /api/cards/:id response**

In `packages/api/src/routes/cards.ts`, inside the `GET /api/cards/:id` handler (around line 23), add after the `dependencies` query:

```typescript
    const tags = db.prepare('SELECT * FROM card_tags WHERE card_id = ? ORDER BY name').all(req.params.id)
```

And add to the response object (after `dependencies` on line 30):

```typescript
      tags: toCamelCaseArray(tags as any[]),
```

- [ ] **Step 2: Add tags to GET /api/boards/:boardId/cards response**

Replace the existing `GET /api/boards/:boardId/cards` handler (lines 11-14) with:

```typescript
  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/cards', async (req, reply) => {
    const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(req.params.boardId) as any[]
    const cardIds = cards.map((c: any) => c.id)
    const allTags = cardIds.length > 0
      ? db.prepare(`SELECT * FROM card_tags WHERE card_id IN (${cardIds.map(() => '?').join(',')}) ORDER BY name`).all(...cardIds) as any[]
      : []
    const tagsByCard = new Map<string, any[]>()
    for (const tag of allTags) {
      const list = tagsByCard.get(tag.card_id) ?? []
      list.push(tag)
      tagsByCard.set(tag.card_id, list)
    }
    const result = cards.map((c: any) => ({
      ...toCamelCase<Record<string, unknown>>(c),
      tags: toCamelCaseArray(tagsByCard.get(c.id) ?? []),
    }))
    return reply.send(result)
  })
```

- [ ] **Step 3: Add POST /api/cards/:id/tags endpoint**

Add after the existing dependencies endpoints (after line 152):

```typescript
  // Tags
  app.post<{ Params: { id: string } }>('/api/cards/:id/tags', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name, color } = req.body as { name: string; color?: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'Tag name is required' })
    const id = randomUUID()
    db.prepare('INSERT INTO card_tags (id, card_id, name, color) VALUES (?, ?, ?, ?)')
      .run(id, req.params.id, name.trim(), color ?? '#64748B')
    const tag = toCamelCase(db.prepare('SELECT * FROM card_tags WHERE id = ?').get(id) as any)
    return reply.status(201).send(tag)
  })

  app.delete<{ Params: { id: string; tagId: string } }>('/api/cards/:id/tags/:tagId', { preHandler: [editorPlus] }, async (req, reply) => {
    db.prepare('DELETE FROM card_tags WHERE id = ? AND card_id = ?').run(req.params.tagId, req.params.id)
    return reply.status(204).send()
  })
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/cards.ts
git commit -m "feat: add card tag endpoints and include tags in card/board responses"
```

---

### Task 6: API client — Add tag methods

**Files:**
- Modify: `packages/web/src/api/client.ts`

- [ ] **Step 1: Add tag methods to cards object and import CardTag**

In `packages/web/src/api/client.ts`, update the import on line 1 to include `CardTag`:

```typescript
import type { Agent, AgentWithChildren, Skill, ProviderConfig, Board, BoardWithColumns, Card, CardWithDetails, CardComment, CardRepo, CardDependency, CardEstimate, AskAgentResponse, CardTag, Conversation, ConversationWithMessages, Message, AgentMemoryEntry, MemoryStats, Spec, SpecReview, SpecRepo, Execution, ExecutionTask, ExecutionGap, ExecutionLog, Repository, BugReport, BugReportWithAttachments } from '@gaud/shared'
```

Then add after line 145 (`askAgent`), inside the `cards` object:

```typescript
    addTag: (cardId: string, data: { name: string; color?: string }) =>
      request<CardTag>(`/cards/${cardId}/tags`, { method: 'POST', body: JSON.stringify(data) }),
    removeTag: (cardId: string, tagId: string) =>
      request<void>(`/cards/${cardId}/tags/${tagId}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat: add addTag/removeTag to API client"
```

---

### Task 7: Frontend — CardTags component

**Files:**
- Create: `packages/web/src/components/cards/CardTags.tsx`

- [ ] **Step 1: Create CardTags component**

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

export function CardTags({ cardId, tags, onUpdate }: CardTagsProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0]!)
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.cards.addTag(cardId, { name: name.trim(), color })
      setName('')
      setColor(TAG_COLORS[0]!)
      setShowAdd(false)
      onUpdate()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(tagId: string) {
    await api.cards.removeTag(cardId, tagId)
    onUpdate()
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemove(tag.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add tag */}
      {showAdd ? (
        <div className="flex flex-col gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tag name"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-1.5">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full cursor-pointer transition-all ${
                  color === c ? 'ring-2 ring-offset-1 ring-[var(--color-primary)]' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!name.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)] cursor-pointer"
        >
          <Plus size={12} />
          Add tag
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/cards/CardTags.tsx
git commit -m "feat: add CardTags component for tag management"
```

---

### Task 8: Frontend — Integrate CardTags into CardDetail

**Files:**
- Modify: `packages/web/src/components/cards/CardDetail.tsx`

- [ ] **Step 1: Import CardTags and add to metadata sidebar**

In `packages/web/src/components/cards/CardDetail.tsx`, add import after line 8:

```typescript
import { CardTags } from './CardTags'
```

Then add a Tags section in the metadata sidebar, after the "Type" MetaField (after line 205) and before the "Assigned Agent" MetaField:

```tsx
        {/* Tags */}
        <MetaField label="Tags">
          <CardTags cardId={card.id} tags={card.tags ?? []} onUpdate={onUpdate} />
        </MetaField>
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/cards/CardDetail.tsx
git commit -m "feat: integrate CardTags into card detail sidebar"
```

---

### Task 9: Frontend — Show tags in KanbanCard

**Files:**
- Modify: `packages/web/src/components/kanban/KanbanCard.tsx`

- [ ] **Step 1: Update KanbanCardProps and add tag pills**

In `packages/web/src/components/kanban/KanbanCard.tsx`, update the import and interface:

Replace line 4:
```typescript
import type { Card, CardTag } from '@gaud/shared'
```

Update the interface (lines 8-10):
```typescript
interface KanbanCardProps {
  card: Card & { tags?: CardTag[] }
  agentName?: string
}
```

Add tag pills after the description paragraph (after line 46, before the badges div):

```tsx
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 pl-[20px]">
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

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/kanban/KanbanCard.tsx
git commit -m "feat: show tag pills on kanban cards"
```

---

### Task 10: BackupService — Add card_tags table

**Files:**
- Modify: `packages/api/src/services/BackupService.ts:8-16`

- [ ] **Step 1: Add card_tags to TABLE_ORDER**

In `packages/api/src/services/BackupService.ts`, update the `TABLE_ORDER` array. Insert `'card_tags'` after `'card_attachments'` (after line 13):

```typescript
const TABLE_ORDER = [
  'users', 'setup_state',
  'providers', 'agents', 'skills', 'agent_skills', 'boards', 'columns', 'repositories',
  'cards', 'card_dependencies', 'card_repos', 'card_comments', 'card_attachments', 'card_tags',
  'specs', 'spec_reviews', 'spec_repos', 'executions', 'execution_tasks', 'execution_logs', 'execution_gaps',
  'conversations', 'conversation_participants', 'messages',
  'agent_cost_log', 'agent_memories', 'memory_sessions', 'agent_reviews',
  'bug_reports', 'bug_report_attachments',
] as const
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/BackupService.ts
git commit -m "feat: include card_tags in backup/restore"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full typecheck — both packages**

Run: `pnpm --filter @gaud/web typecheck && pnpm --filter @gaud/api typecheck`
Expected: 0 errors in both

- [ ] **Step 2: Run API tests**

Run: `pnpm --filter @gaud/api test`
Expected: All tests passing

- [ ] **Step 3: Visual smoke test checklist**

1. Open bug report page — no reporter name/email fields in form
2. Submit a bug report — reporter auto-filled from logged-in user
3. Bug report list shows reporter name
4. Open a card detail — Tags section visible in sidebar
5. Add a tag with color — appears as pill
6. Remove a tag — disappears
7. Kanban board shows mini-pills on tagged cards
