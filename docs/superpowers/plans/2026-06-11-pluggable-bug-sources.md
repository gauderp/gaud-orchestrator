# Pluggable Bug Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow external bug tracking tools (Bugsnag, Trello, custom integrations) to automatically create bug reports via webhooks, with deduplication and per-source configuration.

**Architecture:** A `bug_sources` table stores source configuration (type, webhook secret, JSON config). A public intake endpoint validates the webhook token, dispatches to a type-specific adapter that normalizes the payload, then creates a bug report + card in Triage: New. Adapters are a simple `Map<type, adapter>` registry — adding a new source type means one new file.

**Tech Stack:** Fastify, better-sqlite3, React, TypeScript, crypto (HMAC verification)

**Spec:** `docs/superpowers/specs/2026-06-11-board-simplification-design.md` (Section 4)

**Depends on:** `2026-06-11-board-simplification.md` (Plan 1 must be completed first — requires the 3 fixed boards and simplified bug_reports table)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/api/src/db/migrations/012_bug_sources.sql` | bug_sources table + bug_reports additions (source_id, external_id, external_url, dedup index) |
| Create | `packages/shared/src/types/bug-source.ts` | BugSource type, NormalizedBugIntake interface |
| Create | `packages/api/src/intake/types.ts` | BugSourceAdapter interface |
| Create | `packages/api/src/intake/registry.ts` | Adapter registry (Map + register + get) |
| Create | `packages/api/src/intake/adapters/generic.ts` | Generic adapter: expects NormalizedBugIntake JSON directly |
| Create | `packages/api/src/intake/adapters/bugsnag.ts` | Bugsnag adapter: normalizes error webhook payload |
| Create | `packages/api/src/intake/adapters/trello.ts` | Trello adapter: normalizes card webhook, HMAC-SHA1 verify |
| Create | `packages/api/src/routes/intake.ts` | Public webhook endpoint: POST/HEAD/GET /api/intake/bugs/:sourceId |
| Create | `packages/api/src/routes/bug-sources.ts` | CRUD for bug_sources (list, create, toggle enable, delete) |
| Create | `packages/api/src/__tests__/adapters.test.ts` | Unit tests for adapter normalize + verify functions |
| Modify | `packages/api/src/index.ts` | Register intake + bug-sources routes |
| Modify | `packages/web/src/api/client.ts` | Add bugSources API methods |
| Create | `packages/web/src/pages/BugSourcesPage.tsx` | Config page: list sources, create new, show webhook URL |
| Modify | `packages/web/src/App.tsx` | Add /settings/bug-sources route |
| Modify | `packages/shared/src/types/bug-report.ts` | Add sourceId, externalId, externalUrl fields |

---

### Task 1: Migration 012 — Bug Sources + Bug Reports Additions

**Files:**
- Create: `packages/api/src/db/migrations/012_bug_sources.sql`

- [ ] **Step 1: Write the migration**

Create `packages/api/src/db/migrations/012_bug_sources.sql`:

```sql
-- Migration 012: Pluggable bug sources
-- External tools (Bugsnag, Trello, etc.) push bugs via webhooks

CREATE TABLE IF NOT EXISTS bug_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  webhook_secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add external source tracking to bug_reports
-- SQLite supports ALTER TABLE ADD COLUMN
ALTER TABLE bug_reports ADD COLUMN source_id TEXT REFERENCES bug_sources(id) ON DELETE SET NULL;
ALTER TABLE bug_reports ADD COLUMN external_id TEXT;
ALTER TABLE bug_reports ADD COLUMN external_url TEXT;

-- Dedup index: same source + external ID = same bug
CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_reports_external
  ON bug_reports(source_id, external_id)
  WHERE external_id IS NOT NULL;
```

- [ ] **Step 2: Verify migration applies**

```bash
cd packages/api && pnpm dev
```
Expected: `Migration applied: 012_bug_sources.sql` in logs.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/migrations/012_bug_sources.sql
git commit -m "feat: migration 012 — bug_sources table + dedup index"
```

---

### Task 2: Shared Types

**Files:**
- Create: `packages/shared/src/types/bug-source.ts`
- Modify: `packages/shared/src/types/bug-report.ts`

- [ ] **Step 1: Create bug-source.ts**

Create `packages/shared/src/types/bug-source.ts`:

```typescript
export interface BugSource {
  id: string
  name: string
  type: string
  configJson: string
  webhookSecret: string
  enabled: boolean
  createdAt: string
}

export interface NormalizedBugIntake {
  title: string
  description: string
  externalId?: string
  externalUrl?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  reporterName?: string
  reporterEmail?: string
}
```

- [ ] **Step 2: Add external fields to BugReport type**

In `packages/shared/src/types/bug-report.ts`, add these fields to the `BugReport` interface:

```typescript
  sourceId: string | null
  externalId: string | null
  externalUrl: string | null
```

- [ ] **Step 3: Export from shared index**

If `packages/shared/src/types/index.ts` exists, add:
```typescript
export * from './bug-source'
```

Otherwise, verify the barrel export pattern used and add the export accordingly.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/bug-source.ts packages/shared/src/types/bug-report.ts
git commit -m "feat: shared types for bug sources and normalized intake"
```

---

### Task 3: Adapter Interface + Registry

**Files:**
- Create: `packages/api/src/intake/types.ts`
- Create: `packages/api/src/intake/registry.ts`

- [ ] **Step 1: Create adapter interface**

Create `packages/api/src/intake/types.ts`:

```typescript
import { FastifyRequest } from 'fastify'
import type { NormalizedBugIntake } from '@gaud/shared'

export interface BugSourceRow {
  id: string
  name: string
  type: string
  config_json: string
  webhook_secret: string
  enabled: number
}

export interface BugSourceAdapter {
  type: string
  verify(req: FastifyRequest, source: BugSourceRow): boolean
  normalize(payload: unknown, source: BugSourceRow): NormalizedBugIntake | null
}
```

- [ ] **Step 2: Create adapter registry**

Create `packages/api/src/intake/registry.ts`:

```typescript
import type { BugSourceAdapter } from './types'
import { genericAdapter } from './adapters/generic'
import { bugsnagAdapter } from './adapters/bugsnag'
import { trelloAdapter } from './adapters/trello'

const adapters = new Map<string, BugSourceAdapter>()

export function registerAdapter(adapter: BugSourceAdapter) {
  adapters.set(adapter.type, adapter)
}

export function getAdapter(type: string): BugSourceAdapter | undefined {
  return adapters.get(type)
}

// Register built-in adapters
registerAdapter(genericAdapter)
registerAdapter(bugsnagAdapter)
registerAdapter(trelloAdapter)
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/intake/types.ts packages/api/src/intake/registry.ts
git commit -m "feat: adapter interface and registry for pluggable bug sources"
```

---

### Task 4: Generic Adapter + Test

**Files:**
- Create: `packages/api/src/intake/adapters/generic.ts`
- Create: `packages/api/src/__tests__/adapters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/__tests__/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { genericAdapter } from '../intake/adapters/generic'
import type { BugSourceRow } from '../intake/types'

const mockSource: BugSourceRow = {
  id: 'src-1',
  name: 'Test',
  type: 'generic',
  config_json: '{}',
  webhook_secret: 'test-secret',
  enabled: 1,
}

describe('genericAdapter', () => {
  it('normalizes a valid payload', () => {
    const payload = {
      title: 'Button broken',
      description: 'Click does nothing',
      severity: 'high',
      externalId: 'ext-123',
    }
    const result = genericAdapter.normalize(payload, mockSource)
    expect(result).toEqual({
      title: 'Button broken',
      description: 'Click does nothing',
      severity: 'high',
      externalId: 'ext-123',
    })
  })

  it('returns null for payload without title', () => {
    const result = genericAdapter.normalize({ description: 'no title' }, mockSource)
    expect(result).toBeNull()
  })

  it('verify always returns true (token checked by route)', () => {
    expect(genericAdapter.verify({} as any, mockSource)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement generic adapter**

Create `packages/api/src/intake/adapters/generic.ts`:

```typescript
import type { BugSourceAdapter } from '../types'
import type { NormalizedBugIntake } from '@gaud/shared'

export const genericAdapter: BugSourceAdapter = {
  type: 'generic',

  verify() {
    // Token validation is handled by the intake route — generic has no extra verification
    return true
  },

  normalize(payload: unknown): NormalizedBugIntake | null {
    const p = payload as Record<string, unknown>
    if (!p || typeof p.title !== 'string' || !p.title.trim()) return null

    return {
      title: p.title as string,
      description: (p.description as string) || '',
      externalId: p.externalId as string | undefined,
      externalUrl: p.externalUrl as string | undefined,
      severity: ['critical', 'high', 'medium', 'low'].includes(p.severity as string)
        ? (p.severity as NormalizedBugIntake['severity'])
        : undefined,
      reporterName: p.reporterName as string | undefined,
      reporterEmail: p.reporterEmail as string | undefined,
    }
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/intake/adapters/generic.ts packages/api/src/__tests__/adapters.test.ts
git commit -m "feat: generic bug source adapter with tests"
```

---

### Task 5: Bugsnag Adapter + Test

**Files:**
- Create: `packages/api/src/intake/adapters/bugsnag.ts`
- Modify: `packages/api/src/__tests__/adapters.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/api/src/__tests__/adapters.test.ts`:

```typescript
import { bugsnagAdapter } from '../intake/adapters/bugsnag'

describe('bugsnagAdapter', () => {
  const source: BugSourceRow = {
    id: 'src-2',
    name: 'Bugsnag Prod',
    type: 'bugsnag',
    config_json: '{}',
    webhook_secret: 'bugsnag-secret',
    enabled: 1,
  }

  it('normalizes a firstException trigger', () => {
    const payload = {
      trigger: { type: 'firstException' },
      error: {
        errorId: 'err-abc',
        exceptionClass: 'TypeError',
        message: 'Cannot read property x of null',
        severity: 'error',
        url: 'https://app.bugsnag.com/org/proj/errors/err-abc',
        stackTrace: [
          { file: 'app.js', lineNumber: 42, method: 'handleClick' },
        ],
        context: 'UserDashboard',
      },
      project: { name: 'my-app' },
    }

    const result = bugsnagAdapter.normalize(payload, source)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('TypeError: Cannot read property x of null')
    expect(result!.externalId).toBe('err-abc')
    expect(result!.externalUrl).toBe('https://app.bugsnag.com/org/proj/errors/err-abc')
    expect(result!.severity).toBe('critical')
    expect(result!.description).toContain('handleClick')
    expect(result!.description).toContain('UserDashboard')
  })

  it('returns null for non-error triggers', () => {
    const payload = {
      trigger: { type: 'projectSpiking' },
      error: { errorId: 'err-1' },
    }
    const result = bugsnagAdapter.normalize(payload, source)
    expect(result).toBeNull()
  })

  it('verify returns true (Bugsnag uses token auth, not HMAC)', () => {
    expect(bugsnagAdapter.verify({} as any, source)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement bugsnag adapter**

Create `packages/api/src/intake/adapters/bugsnag.ts`:

```typescript
import type { BugSourceAdapter } from '../types'
import type { NormalizedBugIntake } from '@gaud/shared'

const SEVERITY_MAP: Record<string, NormalizedBugIntake['severity']> = {
  error: 'critical',
  warning: 'high',
  info: 'medium',
}

const RELEVANT_TRIGGERS = new Set(['firstException', 'reopened', 'exception'])

export const bugsnagAdapter: BugSourceAdapter = {
  type: 'bugsnag',

  verify() {
    // Bugsnag authenticates via the webhook URL token — no HMAC header
    return true
  },

  normalize(payload: unknown): NormalizedBugIntake | null {
    const p = payload as any
    if (!p?.trigger?.type || !RELEVANT_TRIGGERS.has(p.trigger.type)) return null
    if (!p?.error) return null

    const error = p.error
    const title = [error.exceptionClass, error.message].filter(Boolean).join(': ')
    if (!title) return null

    const descParts: string[] = []
    if (p.project?.name) descParts.push(`**Project:** ${p.project.name}`)
    if (error.context) descParts.push(`**Context:** ${error.context}`)
    if (error.stackTrace?.length) {
      const top = error.stackTrace.slice(0, 5)
      const formatted = top.map(
        (f: any) => `  ${f.method || '<anonymous>'} (${f.file}:${f.lineNumber})`
      ).join('\n')
      descParts.push(`**Stack trace:**\n\`\`\`\n${formatted}\n\`\`\``)
    }
    if (error.url) descParts.push(`**Bugsnag:** ${error.url}`)

    return {
      title,
      description: descParts.join('\n\n'),
      externalId: error.errorId || undefined,
      externalUrl: error.url || undefined,
      severity: SEVERITY_MAP[error.severity] || 'medium',
    }
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```
Expected: PASS (all tests including bugsnag)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/intake/adapters/bugsnag.ts packages/api/src/__tests__/adapters.test.ts
git commit -m "feat: Bugsnag adapter — normalizes error webhooks with stack traces"
```

---

### Task 6: Trello Adapter + Test

**Files:**
- Create: `packages/api/src/intake/adapters/trello.ts`
- Modify: `packages/api/src/__tests__/adapters.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/api/src/__tests__/adapters.test.ts`:

```typescript
import { trelloAdapter } from '../intake/adapters/trello'
import crypto from 'crypto'

describe('trelloAdapter', () => {
  const source: BugSourceRow = {
    id: 'src-3',
    name: 'Trello Support',
    type: 'trello',
    config_json: JSON.stringify({ listId: 'list-bugs' }),
    webhook_secret: 'trello-api-secret',
    enabled: 1,
  }

  it('normalizes a createCard action on the configured list', () => {
    const payload = {
      action: {
        type: 'createCard',
        data: {
          card: {
            id: 'card-t1',
            name: 'Login page 500 error',
            desc: 'Users report 500 when logging in via SSO',
            shortUrl: 'https://trello.com/c/abc123',
          },
          list: { id: 'list-bugs' },
        },
      },
    }

    const result = trelloAdapter.normalize(payload, source)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Login page 500 error')
    expect(result!.description).toContain('Users report 500')
    expect(result!.description).toContain('https://trello.com/c/abc123')
    expect(result!.externalId).toBe('card-t1')
    expect(result!.externalUrl).toBe('https://trello.com/c/abc123')
  })

  it('returns null for actions on non-configured lists', () => {
    const payload = {
      action: {
        type: 'createCard',
        data: {
          card: { id: 'card-t2', name: 'Feature', desc: '', shortUrl: '' },
          list: { id: 'list-other' },
        },
      },
    }
    const result = trelloAdapter.normalize(payload, source)
    expect(result).toBeNull()
  })

  it('returns null for non-card actions', () => {
    const payload = {
      action: { type: 'addMemberToBoard', data: {} },
    }
    const result = trelloAdapter.normalize(payload, source)
    expect(result).toBeNull()
  })

  it('verify checks HMAC-SHA1 signature', () => {
    const body = JSON.stringify({ action: { type: 'createCard' } })
    const callbackURL = 'https://example.com/api/intake/bugs/src-3?token=trello-api-secret'
    const hash = crypto
      .createHmac('sha1', source.webhook_secret)
      .update(body + callbackURL)
      .digest('base64')

    const req = {
      headers: { 'x-trello-webhook': hash },
      rawBody: body,
      url: '/api/intake/bugs/src-3?token=trello-api-secret',
      hostname: 'example.com',
      protocol: 'https',
    } as any

    expect(trelloAdapter.verify(req, source)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```

- [ ] **Step 3: Implement trello adapter**

Create `packages/api/src/intake/adapters/trello.ts`:

```typescript
import crypto from 'crypto'
import type { FastifyRequest } from 'fastify'
import type { BugSourceAdapter, BugSourceRow } from '../types'
import type { NormalizedBugIntake } from '@gaud/shared'

const CARD_ACTIONS = new Set(['createCard', 'updateCard'])

export const trelloAdapter: BugSourceAdapter = {
  type: 'trello',

  verify(req: FastifyRequest, source: BugSourceRow): boolean {
    const signature = req.headers['x-trello-webhook'] as string
    if (!signature) return false

    const callbackURL = `${req.protocol}://${req.hostname}${req.url}`
    const rawBody = (req as any).rawBody || JSON.stringify(req.body)
    const expected = crypto
      .createHmac('sha1', source.webhook_secret)
      .update(rawBody + callbackURL)
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expected, 'base64')
    )
  },

  normalize(payload: unknown, source: BugSourceRow): NormalizedBugIntake | null {
    const p = payload as any
    const action = p?.action
    if (!action || !CARD_ACTIONS.has(action.type)) return null

    const card = action.data?.card
    const list = action.data?.list
    if (!card?.id || !card?.name) return null

    // Only process cards from the configured list
    const config = JSON.parse(source.config_json || '{}')
    if (config.listId && list?.id !== config.listId) return null

    const descParts: string[] = []
    if (card.desc) descParts.push(card.desc)
    if (card.shortUrl) descParts.push(`\n**Trello:** ${card.shortUrl}`)

    return {
      title: card.name,
      description: descParts.join('\n') || card.name,
      externalId: card.id,
      externalUrl: card.shortUrl || undefined,
    }
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/api && npx vitest run src/__tests__/adapters.test.ts
```
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/intake/adapters/trello.ts packages/api/src/__tests__/adapters.test.ts
git commit -m "feat: Trello adapter — HMAC-SHA1 verify + card webhook normalization"
```

---

### Task 7: Intake Route (Public Webhook Endpoint)

**Files:**
- Create: `packages/api/src/routes/intake.ts`

- [ ] **Step 1: Create the intake route**

Create `packages/api/src/routes/intake.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { getDb } from '../db/connection'
import { getAdapter } from '../intake/registry'
import { broadcast } from '../ws/broadcast'
import { BOARD_IDS, TRIAGE_COLUMNS } from '@gaud/shared'
import type { BugSourceRow } from '../intake/types'

export function intakeRoutes(app: FastifyInstance) {
  // Trello sends HEAD/GET to validate the webhook URL on registration
  app.head('/api/intake/bugs/:sourceId', async (req, reply) => {
    return reply.status(200).send()
  })

  app.get('/api/intake/bugs/:sourceId', async (req, reply) => {
    return reply.status(200).send()
  })

  // Main webhook endpoint — public, no JWT
  app.post<{ Params: { sourceId: string }; Querystring: { token?: string } }>(
    '/api/intake/bugs/:sourceId',
    async (req, reply) => {
      const db = getDb()
      const { sourceId } = req.params
      const token = (req.query as any).token as string

      // 1. Validate source exists and is enabled
      const source = db.prepare(
        'SELECT * FROM bug_sources WHERE id = ? AND enabled = 1'
      ).get(sourceId) as BugSourceRow | undefined

      if (!source) return reply.status(404).send({ error: 'Source not found or disabled' })

      // 2. Validate token
      if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(source.webhook_secret))) {
        return reply.status(401).send({ error: 'Invalid token' })
      }

      // 3. Get adapter for this source type
      const adapter = getAdapter(source.type)
      if (!adapter) return reply.status(400).send({ error: `No adapter for type: ${source.type}` })

      // 4. Adapter-specific verification (e.g., Trello HMAC)
      if (!adapter.verify(req, source)) {
        return reply.status(401).send({ error: 'Adapter verification failed' })
      }

      // 5. Normalize the payload
      const normalized = adapter.normalize(req.body, source)
      if (!normalized) {
        // Adapter says ignore this event (e.g., irrelevant Bugsnag trigger)
        return reply.status(200).send({ ignored: true })
      }

      // 6. Dedup check
      if (normalized.externalId) {
        const existing = db.prepare(
          'SELECT id FROM bug_reports WHERE source_id = ? AND external_id = ?'
        ).get(source.id, normalized.externalId) as any

        if (existing) {
          // Update existing report instead of creating duplicate
          db.prepare(
            'UPDATE bug_reports SET description = ?, updated_at = datetime(\'now\') WHERE id = ?'
          ).run(normalized.description, existing.id)
          return reply.status(200).send({ deduplicated: true, reportId: existing.id })
        }
      }

      // 7. Create bug report + card (same flow as manual creation)
      const reportId = crypto.randomUUID()
      const cardId = crypto.randomUUID()
      const conversationId = crypto.randomUUID()

      // Create conversation
      db.prepare(
        'INSERT INTO conversations (id, type, status, created_at) VALUES (?, \'research\', \'active\', datetime(\'now\'))'
      ).run(conversationId)

      // Create card in Triage: New
      db.prepare(
        'INSERT INTO cards (id, board_id, column_id, type, title, description, position, created_at, updated_at) VALUES (?, ?, ?, \'bug\', ?, ?, 0, datetime(\'now\'), datetime(\'now\'))'
      ).run(cardId, BOARD_IDS.TRIAGE, TRIAGE_COLUMNS.NEW, normalized.title, normalized.description)

      // Create bug report
      db.prepare(`
        INSERT INTO bug_reports (id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, source_id, external_id, external_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        reportId,
        normalized.title,
        normalized.description,
        normalized.reporterName || null,
        normalized.reporterEmail || null,
        source.type,
        normalized.severity || null,
        cardId,
        conversationId,
        source.id,
        normalized.externalId || null,
        normalized.externalUrl || null
      )

      broadcast('card:created', { cardId, boardId: BOARD_IDS.TRIAGE, columnId: TRIAGE_COLUMNS.NEW })
      broadcast('bug_report:created', { id: reportId, sourceType: source.type })

      return reply.status(201).send({ reportId, cardId })
    }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/intake.ts
git commit -m "feat: public intake endpoint for bug source webhooks with dedup"
```

---

### Task 8: Bug Sources CRUD Route

**Files:**
- Create: `packages/api/src/routes/bug-sources.ts`

- [ ] **Step 1: Create bug sources CRUD**

Create `packages/api/src/routes/bug-sources.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { getDb } from '../db/connection'

export function bugSourceRoutes(app: FastifyInstance) {
  // List all bug sources
  app.get('/api/bug-sources', async () => {
    const db = getDb()
    return db.prepare('SELECT * FROM bug_sources ORDER BY created_at DESC').all()
  })

  // Create a new bug source
  app.post<{ Body: { name: string; type: string; configJson?: string } }>(
    '/api/bug-sources',
    async (req) => {
      const db = getDb()
      const { name, type, configJson } = req.body as any
      const id = crypto.randomUUID()
      const webhookSecret = crypto.randomBytes(32).toString('hex')

      db.prepare(
        'INSERT INTO bug_sources (id, name, type, config_json, webhook_secret) VALUES (?, ?, ?, ?, ?)'
      ).run(id, name, type, configJson || '{}', webhookSecret)

      return db.prepare('SELECT * FROM bug_sources WHERE id = ?').get(id)
    }
  )

  // Toggle enabled/disabled
  app.put<{ Params: { id: string }; Body: { enabled: boolean } }>(
    '/api/bug-sources/:id',
    async (req, reply) => {
      const db = getDb()
      const { enabled } = req.body as any
      const result = db.prepare(
        'UPDATE bug_sources SET enabled = ? WHERE id = ?'
      ).run(enabled ? 1 : 0, req.params.id)

      if (result.changes === 0) return reply.status(404).send({ error: 'Source not found' })
      return db.prepare('SELECT * FROM bug_sources WHERE id = ?').get(req.params.id)
    }
  )

  // Delete a bug source
  app.delete<{ Params: { id: string } }>(
    '/api/bug-sources/:id',
    async (req, reply) => {
      const db = getDb()
      const result = db.prepare('DELETE FROM bug_sources WHERE id = ?').run(req.params.id)
      if (result.changes === 0) return reply.status(404).send({ error: 'Source not found' })
      return { success: true }
    }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/bug-sources.ts
git commit -m "feat: bug sources CRUD — create, toggle, delete"
```

---

### Task 9: Register Routes in index.ts

**Files:**
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Register intake and bug-sources routes**

In `packages/api/src/index.ts`:

1. Add imports:
   ```typescript
   import { intakeRoutes } from './routes/intake'
   import { bugSourceRoutes } from './routes/bug-sources'
   ```

2. Register routes (intake BEFORE auth middleware so it's public; bug-sources after auth):
   ```typescript
   // Public routes (no JWT) — register before auth middleware
   intakeRoutes(app)
   
   // ... existing auth setup ...
   
   // Protected routes
   bugSourceRoutes(app)
   ```

   **Important:** The intake route must not require JWT authentication. Check how the existing `slackWebhookRoutes` handles this — it's likely registered before the auth middleware or uses a route-level override. Follow the same pattern.

- [ ] **Step 2: Enable rawBody for Fastify**

Trello adapter needs `req.rawBody`. Add to Fastify config if not present:

Check if `@fastify/raw-body` is already installed. If not:
```bash
cd packages/api && pnpm add @fastify/raw-body
```

Then register in `index.ts`:
```typescript
import rawBody from '@fastify/raw-body'
await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true })
```

And add `config: { rawBody: true }` to the intake POST route options.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/index.ts packages/api/package.json
git commit -m "feat: register intake and bug-sources routes"
```

---

### Task 10: API Client Methods

**Files:**
- Modify: `packages/web/src/api/client.ts`

- [ ] **Step 1: Add bugSources methods to API client**

In `packages/web/src/api/client.ts`, add:

```typescript
bugSources: {
  list: () => fetchApi('/api/bug-sources'),
  create: (data: { name: string; type: string; configJson?: string }) =>
    fetchApi('/api/bug-sources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { enabled: boolean }) =>
    fetchApi(`/api/bug-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchApi(`/api/bug-sources/${id}`, { method: 'DELETE' }),
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat: API client methods for bug sources"
```

---

### Task 11: Bug Sources Config Page

**Files:**
- Create: `packages/web/src/pages/BugSourcesPage.tsx`

- [ ] **Step 1: Create the config page**

Create `packages/web/src/pages/BugSourcesPage.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Webhook, Plus, Trash2, Copy, Check, Power, PowerOff } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { BugSource } from '@gaud/shared'

const SOURCE_TYPES = [
  { value: 'generic', label: 'Generic (JSON)', description: 'Accepts NormalizedBugIntake JSON — for curl or custom integrations' },
  { value: 'bugsnag', label: 'Bugsnag', description: 'Receives Bugsnag error webhooks (firstException, reopened)' },
  { value: 'trello', label: 'Trello', description: 'Receives Trello card webhooks with HMAC-SHA1 verification' },
]

export default function BugSourcesPage() {
  const [sources, setSources] = useState<BugSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('generic')
  const [configJson, setConfigJson] = useState('{}')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadSources() }, [])

  async function loadSources() {
    setLoading(true)
    const data = await api.bugSources.list()
    setSources(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!name.trim()) return
    await api.bugSources.create({ name: name.trim(), type, configJson })
    setShowCreate(false)
    setName('')
    setType('generic')
    setConfigJson('{}')
    loadSources()
  }

  async function handleToggle(source: BugSource) {
    await api.bugSources.update(source.id, { enabled: !source.enabled })
    loadSources()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bug source? Existing bug reports will keep their data.')) return
    await api.bugSources.delete(id)
    loadSources()
  }

  function getWebhookUrl(source: BugSource) {
    return `${window.location.origin}/api/intake/bugs/${source.id}?token=${source.webhookSecret}`
  }

  function copyUrl(source: BugSource) {
    navigator.clipboard.writeText(getWebhookUrl(source))
    setCopied(source.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Webhook className="w-6 h-6 text-[var(--color-text-secondary)]" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Bug Sources</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Source
        </Button>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        External tools send bugs via webhooks. Each source gets a unique URL with an auth token.
        Internal sources (UI, Slack, MCP) work as before — this page is for external integrations.
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-lg bg-[var(--color-bg-tertiary)]" />)}
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No external bug sources configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div
              key={source.id}
              className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{source.name}</h3>
                  <Badge variant={source.enabled ? 'success' : 'neutral'}>
                    {source.type}
                  </Badge>
                  {!source.enabled && (
                    <Badge variant="warning">Disabled</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(source)}>
                    {source.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(source.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 text-xs p-2 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {getWebhookUrl(source)}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyUrl(source)}>
                  {copied === source.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Add Bug Source" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Bugsnag Production" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Type</label>
              <select
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-sm"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {SOURCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {SOURCE_TYPES.find(t => t.value === type)?.description}
              </p>
            </div>
            {type === 'trello' && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Config JSON <span className="text-[var(--color-text-secondary)] font-normal">(optional)</span>
                </label>
                <Input
                  value={configJson}
                  onChange={e => setConfigJson(e.target.value)}
                  placeholder='{"listId": "..."}'
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Set listId to only capture cards from a specific Trello list.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/BugSourcesPage.tsx
git commit -m "feat: Bug Sources config page — list, create, toggle, copy webhook URL"
```

---

### Task 12: Update App Routing

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Add route for Bug Sources page**

In `packages/web/src/App.tsx`:

1. Add import:
   ```typescript
   import BugSourcesPage from './pages/BugSourcesPage'
   ```

2. Add route inside the settings group (near `/settings/backup`, `/settings/users`):
   ```tsx
   <Route path="/settings/bug-sources" element={<BugSourcesPage />} />
   ```

3. If there's a settings sidebar/nav component, add a link to "Bug Sources" pointing to `/settings/bug-sources`.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/App.tsx
git commit -m "feat: add bug sources route to app settings"
```

---

### Task 13: Integration Verification

- [ ] **Step 1: Start the server**

```bash
pnpm dev
```

- [ ] **Step 2: Create a test bug source via the UI**

Navigate to `/settings/bug-sources`, create a "Test Generic" source with type "generic". Copy the webhook URL.

- [ ] **Step 3: Test the webhook**

```bash
curl -X POST "<webhook-url>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test bug from curl","description":"Testing the intake webhook","severity":"low"}'
```

Expected: 201 response with `{ reportId, cardId }`.

- [ ] **Step 4: Verify card appears**

Navigate to the Triage board (`/boards/triage-board`). The new card should appear in the "New" column.

- [ ] **Step 5: Test dedup**

Re-send the same curl with `externalId`:
```bash
curl -X POST "<webhook-url>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test bug","description":"Updated description","externalId":"ext-1"}'
```

First call: 201 (created). Second call: 200 with `{ deduplicated: true }`.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: integration verification fixes for bug sources"
```

---
