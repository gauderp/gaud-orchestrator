# Board Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify work state into the card's column as single source of truth across 3 fixed boards (Triage, Spec, Dev), eliminating duplicated status fields in bug_reports, specs, and execution_tasks.

**Architecture:** Migration 011 creates the 3 fixed boards with constant IDs, migrates all existing cards, recreates tables to drop status columns, and removes the generic column workflow engine (agent_action_prompt, auto_move, role_required). Backend routes are simplified to remove board CRUD and status sync. Frontend replaces the dynamic board list with fixed navigation and removes BoardSettingsPage.

**Tech Stack:** better-sqlite3, Fastify, React, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-06-11-board-simplification-design.md`

**Prerequisite for:** `2026-06-11-pluggable-bug-sources.md` (Plan 2)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/api/src/db/migrations/011_simplify_boards.sql` | Schema migration: 3 fixed boards, card migration, drop status columns, drop execution_tasks/gaps/logs, simplify columns |
| Modify | `packages/shared/src/constants.ts` | Replace `BUG_COLUMNS`/`BUG_BOARD_ID` with `BOARD_IDS`, `TRIAGE_COLUMNS`, `SPEC_COLUMNS`, `DEV_COLUMNS`; remove `SPEC_STATUSES`, `EXECUTION_STATUSES` |
| Modify | `packages/shared/src/types/board.ts` | Remove `agentActionPrompt`, `autoMove`, `roleRequired` from `Column` |
| Modify | `packages/shared/src/types/bug-report.ts` | Remove `BugReportStatus`, `BugSource` type union; `source` becomes `string` |
| Modify | `packages/shared/src/types/spec.ts` | Remove `SpecStatus`; add `cardId: string` |
| Modify | `packages/shared/src/types/execution.ts` | Replace with run-log model; remove `ExecutionTask`, `ExecutionGap` |
| Modify | `packages/api/src/routes/boards.ts` | Remove POST/PUT/DELETE boards, POST/PUT/DELETE columns; keep GET |
| Modify | `packages/api/src/routes/cards.ts` | Add `POST /api/cards/:id/send-to-dev`, `POST /api/cards/:id/send-to-spec`, `POST /api/cards/:id/reopen`; remove `executeColumnAction` call |
| Modify | `packages/api/src/routes/bug-reports.ts` | Remove status management; use `TRIAGE_COLUMNS` |
| Modify | `packages/api/src/routes/specs.ts` | Remove status management; move card on review verdict |
| Modify | `packages/api/src/routes/executions.ts` | Simplify to run-log model |
| Modify | `packages/api/src/routes/setup.ts` | Remove Development board creation |
| Modify | `packages/api/src/services/bug-triage.ts` | Remove all `bug_reports.status` updates; only move cards |
| Modify | `packages/api/src/services/execution-engine.ts` | Operate on cards directly; write to run-log executions |
| Modify | `packages/api/src/index.ts` | Remove `columnActionRoutes` import if separate |
| Delete | `packages/api/src/services/column-action.ts` | Dead code — generic workflow engine removed |
| Delete | `packages/web/src/pages/BoardSettingsPage.tsx` | Dead code — no column config UI |
| Modify | `packages/web/src/App.tsx` | Remove `/boards/:id/settings` route; update nav |
| Modify | `packages/web/src/pages/BoardListPage.tsx` | Replace dynamic list with 3 fixed board cards |
| Modify | `packages/web/src/pages/BoardViewPage.tsx` | Remove Settings link |
| Modify | `packages/web/src/pages/BugReportPage.tsx` | Use `BOARD_IDS.TRIAGE` instead of `BUG_BOARD_ID`; remove status badges |
| Modify | `packages/web/src/pages/BugReportDetailPage.tsx` | Remove status management; use column-based state; replace "Assign to Development" with "Send to Development"/"Send to Spec" actions |
| Modify | `packages/web/src/api/client.ts` | Add handoff API methods; remove board CRUD methods |

---

### Task 1: Migration 011 — Schema Changes

**Files:**
- Create: `packages/api/src/db/migrations/011_simplify_boards.sql`

- [ ] **Step 1: Write the migration SQL**

Create `packages/api/src/db/migrations/011_simplify_boards.sql`:

```sql
-- Migration 011: Simplify to 3 fixed boards
-- Column = single source of truth for work state
PRAGMA foreign_keys = OFF;

------------------------------------------------------------
-- 1. Create the 3 fixed boards
------------------------------------------------------------
INSERT OR IGNORE INTO boards (id, name) VALUES ('triage-board', 'Triage');
INSERT OR IGNORE INTO boards (id, name) VALUES ('spec-board', 'Spec');
INSERT OR IGNORE INTO boards (id, name) VALUES ('dev-board', 'Dev');

------------------------------------------------------------
-- 2. Create fixed columns
------------------------------------------------------------
INSERT OR IGNORE INTO columns (id, board_id, name, color, position, agent_action_prompt, auto_move, role_required) VALUES
  ('triage-col-new',          'triage-board', 'New',          '#3B82F6', 0, NULL, 0, NULL),
  ('triage-col-interviewing', 'triage-board', 'Interviewing', '#F59E0B', 1, NULL, 0, NULL),
  ('triage-col-triaged',      'triage-board', 'Triaged',      '#8B5CF6', 2, NULL, 0, NULL),
  ('triage-col-rejected',     'triage-board', 'Rejected',     '#EF4444', 3, NULL, 0, NULL);

INSERT OR IGNORE INTO columns (id, board_id, name, color, position, agent_action_prompt, auto_move, role_required) VALUES
  ('spec-col-ideas',    'spec-board', 'Ideas',    '#3B82F6', 0, NULL, 0, NULL),
  ('spec-col-drafting', 'spec-board', 'Drafting', '#F59E0B', 1, NULL, 0, NULL),
  ('spec-col-review',   'spec-board', 'Review',   '#8B5CF6', 2, NULL, 0, NULL),
  ('spec-col-approved', 'spec-board', 'Approved', '#10B981', 3, NULL, 0, NULL);

INSERT OR IGNORE INTO columns (id, board_id, name, color, position, agent_action_prompt, auto_move, role_required) VALUES
  ('dev-col-todo',     'dev-board', 'To Do',       '#3B82F6', 0, NULL, 0, NULL),
  ('dev-col-progress', 'dev-board', 'In Progress', '#F59E0B', 1, NULL, 0, NULL),
  ('dev-col-review',   'dev-board', 'Review',      '#8B5CF6', 2, NULL, 0, NULL),
  ('dev-col-done',     'dev-board', 'Done',        '#10B981', 3, NULL, 0, NULL);

------------------------------------------------------------
-- 3. Migrate cards from old bug board → Triage + Dev
------------------------------------------------------------
UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-new'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-new';

UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-interviewing'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-triaging';

UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-triaged'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-triaged';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-progress'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-progress';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-review'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-testing';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-reopened';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-done'
  WHERE board_id = 'bug-triage-board' AND column_id = 'bug-col-done';

------------------------------------------------------------
-- 4. Migrate cards from setup-created Development boards → Dev
--    Match columns by name within Development boards
------------------------------------------------------------
UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    AND column_id IN (
      SELECT id FROM columns
      WHERE name IN ('Backlog', 'To Do', 'Spec', 'Approved')
        AND board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-progress'
  WHERE board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    AND column_id IN (
      SELECT id FROM columns WHERE name = 'Executing'
        AND board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-review'
  WHERE board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    AND column_id IN (
      SELECT id FROM columns WHERE name = 'Review'
        AND board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-done'
  WHERE board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    AND column_id IN (
      SELECT id FROM columns WHERE name = 'Done'
        AND board_id IN (SELECT id FROM boards WHERE name = 'Development' AND id != 'dev-board')
    );

------------------------------------------------------------
-- 5. Catch-all: any remaining cards on non-fixed boards → Dev To Do
------------------------------------------------------------
UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE board_id NOT IN ('triage-board', 'spec-board', 'dev-board');

------------------------------------------------------------
-- 6. Create cards for existing specs and link them
--    Specs with source_card_id: move that card to Spec board
--    Specs without: create new card with deterministic ID
------------------------------------------------------------

-- 6a. Move existing spec-linked cards to Spec board
UPDATE cards SET
  board_id = 'spec-board',
  column_id = (
    SELECT CASE s.status
      WHEN 'draft' THEN 'spec-col-drafting'
      WHEN 'review' THEN 'spec-col-review'
      WHEN 'approved' THEN 'spec-col-approved'
      ELSE 'spec-col-ideas'
    END
    FROM specs s WHERE s.source_card_id = cards.id
  )
WHERE id IN (SELECT source_card_id FROM specs WHERE source_card_id IS NOT NULL);

-- 6b. Create cards for orphan specs (no source_card_id)
INSERT INTO cards (id, board_id, column_id, type, title, description, position, created_at, updated_at)
  SELECT
    'spec-card-' || id,
    'spec-board',
    CASE status
      WHEN 'draft' THEN 'spec-col-drafting'
      WHEN 'review' THEN 'spec-col-review'
      WHEN 'approved' THEN 'spec-col-approved'
      ELSE 'spec-col-ideas'
    END,
    'task',
    title,
    CASE WHEN length(content) > 200 THEN substr(content, 1, 200) || '...' ELSE content END,
    0,
    created_at,
    updated_at
  FROM specs
  WHERE source_card_id IS NULL;

-- 6c. Backfill source_card_id for orphan specs (so the copy step picks it up)
UPDATE specs SET source_card_id = 'spec-card-' || id WHERE source_card_id IS NULL;

------------------------------------------------------------
-- 7. Recreate bug_reports — drop status, free-text source
------------------------------------------------------------
CREATE TABLE bug_reports_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reporter_name TEXT,
  reporter_email TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  severity TEXT CHECK(severity IN ('critical','high','medium','low')),
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  triage_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO bug_reports_new (id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, triage_summary, created_at, updated_at)
  SELECT id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, triage_summary, created_at, updated_at
  FROM bug_reports;

DROP TABLE bug_report_attachments;
DROP TABLE bug_reports;
ALTER TABLE bug_reports_new RENAME TO bug_reports;

-- Re-create bug_report_attachments referencing new table
CREATE TABLE bug_report_attachments (
  id TEXT PRIMARY KEY,
  bug_report_id TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  file_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bug_reports_card ON bug_reports(card_id);

------------------------------------------------------------
-- 8. Recreate specs — drop status, rename source_card_id → card_id
------------------------------------------------------------
CREATE TABLE specs_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_type TEXT CHECK(created_by_type IN ('user','agent')) DEFAULT 'user',
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO specs_new (id, title, content, card_id, version, created_by_type, created_by_id, created_at, updated_at)
  SELECT id, title, content, source_card_id, version, created_by_type, created_by_id, created_at, updated_at
  FROM specs;

DROP TABLE specs;
ALTER TABLE specs_new RENAME TO specs;

CREATE INDEX idx_specs_card ON specs(card_id);

------------------------------------------------------------
-- 9. Recreate executions as run-log, drop execution_tasks/gaps/logs
------------------------------------------------------------
CREATE TABLE executions_new (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  outcome TEXT CHECK(outcome IN ('success','failed')),
  pr_url TEXT,
  branch TEXT
);

INSERT INTO executions_new (id, card_id, started_at, finished_at, outcome)
  SELECT
    id,
    COALESCE(card_id, 'dev-col-todo'),
    created_at,
    CASE WHEN status IN ('done','failed') THEN updated_at ELSE NULL END,
    CASE WHEN status = 'done' THEN 'success' WHEN status = 'failed' THEN 'failed' ELSE NULL END
  FROM executions
  WHERE card_id IS NOT NULL;

DROP TABLE IF EXISTS execution_logs;
DROP TABLE IF EXISTS execution_gaps;
DROP TABLE IF EXISTS execution_tasks;
DROP TABLE executions;
ALTER TABLE executions_new RENAME TO executions;

CREATE INDEX idx_executions_card ON executions(card_id);

------------------------------------------------------------
-- 10. Recreate columns — drop agent_action_prompt, auto_move, role_required
--     Only keep columns for the 3 fixed boards
------------------------------------------------------------
CREATE TABLE columns_new (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO columns_new (id, board_id, name, color, position, created_at)
  SELECT id, board_id, name, color, position, created_at
  FROM columns
  WHERE board_id IN ('triage-board', 'spec-board', 'dev-board');

DROP TABLE columns;
ALTER TABLE columns_new RENAME TO columns;

------------------------------------------------------------
-- 11. Delete old boards
------------------------------------------------------------
DELETE FROM boards WHERE id NOT IN ('triage-board', 'spec-board', 'dev-board');

PRAGMA foreign_keys = ON;
```

- [ ] **Step 2: Verify migration applies on a clean database**

Run:
```bash
cd packages/api && cp data/orchestrator.db data/orchestrator.db.bak
pnpm dev
```
Expected: Server starts without migration errors. Check logs for `Migration applied: 011_simplify_boards.sql`.

- [ ] **Step 3: Verify data integrity**

Run in a SQLite shell or Node script:
```sql
-- Must return exactly 3
SELECT COUNT(*) FROM boards;

-- Must return 0 (no orphan cards)
SELECT COUNT(*) FROM cards WHERE column_id NOT IN (SELECT id FROM columns);

-- Must return 0 (no orphan cards on deleted boards)
SELECT COUNT(*) FROM cards WHERE board_id NOT IN (SELECT id FROM boards);

-- execution_tasks must not exist
SELECT name FROM sqlite_master WHERE type='table' AND name='execution_tasks';

-- All specs must have card_id
SELECT COUNT(*) FROM specs WHERE card_id IS NULL;
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/migrations/011_simplify_boards.sql
git commit -m "feat: migration 011 — simplify to 3 fixed boards, drop status columns"
```

---

### Task 2: Shared Constants + Types

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types/board.ts`
- Modify: `packages/shared/src/types/bug-report.ts`
- Modify: `packages/shared/src/types/spec.ts`
- Modify: `packages/shared/src/types/execution.ts`

- [ ] **Step 1: Replace constants.ts**

Replace the entire content of `packages/shared/src/constants.ts`:

```typescript
export const CARD_TYPES = ['project', 'epic', 'task', 'bug'] as const
export const CONVERSATION_TYPES = ['spec', 'plan', 'code', 'research', 'review'] as const
export const MEMORY_TYPES = ['conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference'] as const

export const BOARD_IDS = {
  TRIAGE: 'triage-board',
  SPEC: 'spec-board',
  DEV: 'dev-board',
} as const

export const TRIAGE_COLUMNS = {
  NEW: 'triage-col-new',
  INTERVIEWING: 'triage-col-interviewing',
  TRIAGED: 'triage-col-triaged',
  REJECTED: 'triage-col-rejected',
} as const

export const SPEC_COLUMNS = {
  IDEAS: 'spec-col-ideas',
  DRAFTING: 'spec-col-drafting',
  REVIEW: 'spec-col-review',
  APPROVED: 'spec-col-approved',
} as const

export const DEV_COLUMNS = {
  TODO: 'dev-col-todo',
  IN_PROGRESS: 'dev-col-progress',
  REVIEW: 'dev-col-review',
  DONE: 'dev-col-done',
} as const
```

- [ ] **Step 2: Update board.ts — remove workflow columns from Column type**

Replace `packages/shared/src/types/board.ts`:

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
  createdAt: string
}

export interface BoardWithColumns extends Board {
  columns: Column[]
}
```

- [ ] **Step 3: Update bug-report.ts — remove status type**

Replace `packages/shared/src/types/bug-report.ts`:

```typescript
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface BugReport {
  id: string
  title: string
  description: string | null
  reporterName: string | null
  reporterEmail: string | null
  source: string
  severity: BugSeverity | null
  cardId: string | null
  conversationId: string | null
  triageSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface BugReportAttachment {
  id: string
  bugReportId: string
  filename: string
  path: string
  fileType: string | null
  createdAt: string
}

export interface BugReportWithAttachments extends BugReport {
  attachments: BugReportAttachment[]
}
```

- [ ] **Step 4: Update spec.ts — remove status, add cardId**

Replace `packages/shared/src/types/spec.ts`:

```typescript
export interface Spec {
  id: string
  title: string
  content: string | null
  cardId: string
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

export interface SpecRepo {
  id: string
  specId: string
  repoPath: string
  repositoryId: string | null
  createdAt: string
}
```

- [ ] **Step 5: Update execution.ts — run-log model**

Replace `packages/shared/src/types/execution.ts`:

```typescript
export type ExecutionOutcome = 'success' | 'failed'

export interface Execution {
  id: string
  cardId: string
  startedAt: string
  finishedAt: string | null
  outcome: ExecutionOutcome | null
  prUrl: string | null
  branch: string | null
}
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @gaud/shared typecheck`
Expected: May have errors in API/web packages that import removed types — that's expected and will be fixed in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types/board.ts packages/shared/src/types/bug-report.ts packages/shared/src/types/spec.ts packages/shared/src/types/execution.ts
git commit -m "feat: update shared constants and types for 3 fixed boards"
```

---

### Task 3: Backend — Simplify Board Routes

**Files:**
- Modify: `packages/api/src/routes/boards.ts`

- [ ] **Step 1: Strip boards.ts to GET-only routes**

Replace the entire content of `packages/api/src/routes/boards.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection'

export function boardRoutes(app: FastifyInstance) {
  // List all boards
  app.get('/api/boards', async () => {
    const db = getDb()
    const boards = db.prepare('SELECT * FROM boards ORDER BY name').all()
    return boards
  })

  // Get board with columns
  app.get<{ Params: { id: string } }>('/api/boards/:id', async (req, reply) => {
    const db = getDb()
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id)
    if (!board) return reply.status(404).send({ error: 'Board not found' })

    const columns = db.prepare(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position'
    ).all(req.params.id)

    return { ...board, columns }
  })
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`
Expected: Errors in files that import removed board/column CRUD functions — will be fixed in later tasks. Board routes themselves should compile.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/boards.ts
git commit -m "refactor: strip board routes to GET-only — boards are fixed"
```

---

### Task 4: Backend — Card Handoff Endpoints

**Files:**
- Modify: `packages/api/src/routes/cards.ts`

- [ ] **Step 1: Add handoff endpoints to cards.ts**

Add these routes at the end of the `cardRoutes` function in `packages/api/src/routes/cards.ts`, before the closing `}`:

```typescript
  // Send card from Triage → Dev: To Do
  app.post<{ Params: { id: string } }>('/api/cards/:id/send-to-dev', async (req, reply) => {
    const db = getDb()
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    db.prepare(
      'UPDATE cards SET board_id = ?, column_id = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(BOARD_IDS.DEV, DEV_COLUMNS.TODO, card.id)

    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, \'system\', \'system\', ?, datetime(\'now\'))'
    ).run(crypto.randomUUID(), card.id, 'Sent to Development from Triage')

    broadcast('card:moved', { cardId: card.id, boardId: BOARD_IDS.DEV, columnId: DEV_COLUMNS.TODO })
    return { success: true }
  })

  // Send card from Triage → Spec: Ideas (bug becomes feature request)
  app.post<{ Params: { id: string } }>('/api/cards/:id/send-to-spec', async (req, reply) => {
    const db = getDb()
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    db.prepare(
      'UPDATE cards SET board_id = ?, column_id = ?, type = \'task\', updated_at = datetime(\'now\') WHERE id = ?'
    ).run(BOARD_IDS.SPEC, SPEC_COLUMNS.IDEAS, card.id)

    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, \'system\', \'system\', ?, datetime(\'now\'))'
    ).run(crypto.randomUUID(), card.id, 'Converted to feature request — sent to Spec')

    broadcast('card:moved', { cardId: card.id, boardId: BOARD_IDS.SPEC, columnId: SPEC_COLUMNS.IDEAS })
    return { success: true }
  })

  // Reopen card: Dev Done → Dev To Do
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/api/cards/:id/reopen', async (req, reply) => {
    const db = getDb()
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })
    if (card.column_id !== DEV_COLUMNS.DONE) {
      return reply.status(400).send({ error: 'Only cards in Done can be reopened' })
    }

    db.prepare(
      'UPDATE cards SET column_id = ?, completed_at = NULL, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(DEV_COLUMNS.TODO, card.id)

    const reason = (req.body as any)?.reason || 'Reopened'
    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, \'system\', \'system\', ?, datetime(\'now\'))'
    ).run(crypto.randomUUID(), card.id, `Reopened: ${reason}`)

    broadcast('card:moved', { cardId: card.id, boardId: BOARD_IDS.DEV, columnId: DEV_COLUMNS.TODO })
    return { success: true }
  })
```

- [ ] **Step 2: Add imports to cards.ts**

Add at the top of `packages/api/src/routes/cards.ts`:

```typescript
import { BOARD_IDS, TRIAGE_COLUMNS, SPEC_COLUMNS, DEV_COLUMNS } from '@gaud/shared'
import crypto from 'crypto'
```

- [ ] **Step 3: Remove executeColumnAction call from PUT /api/cards/:id/move**

In the `PUT /api/cards/:id/move` handler, find and remove the block that calls `executeColumnAction`. The move endpoint should just update `column_id` and broadcast — no more automatic agent actions on column change.

Remove this pattern (approximately):
```typescript
// REMOVE: any code that checks column.agent_action_prompt and calls executeColumnAction
if (column.agent_action_prompt) {
  executeColumnAction(...)
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/cards.ts
git commit -m "feat: add card handoff endpoints (send-to-dev, send-to-spec, reopen)"
```

---

### Task 5: Backend — Simplify Bug Triage Service

**Files:**
- Modify: `packages/api/src/services/bug-triage.ts`

- [ ] **Step 1: Remove all status updates from bug-triage.ts**

In `packages/api/src/services/bug-triage.ts`, make these changes:

1. Replace import of `BUG_BOARD_ID, BUG_COLUMNS` with `BOARD_IDS, TRIAGE_COLUMNS` from `@gaud/shared`.

2. In `createReport()`: remove any line that sets `status` in the INSERT statement for `bug_reports`. The INSERT should no longer include a `status` column.

3. In `startTriage()`:
   - Remove: `db.prepare('UPDATE bug_reports SET status = ? ...').run('triaging', ...)`
   - Keep: card move to `TRIAGE_COLUMNS.INTERVIEWING` (was `BUG_COLUMNS.TRIAGING`)
   
4. On `[TRIAGED]` detection:
   - Remove: `db.prepare('UPDATE bug_reports SET status = ? ...').run('triaged', ...)`
   - Keep: card move to `TRIAGE_COLUMNS.TRIAGED` (was `BUG_COLUMNS.TRIAGED`)
   - Keep: triage_summary and severity updates on bug_reports

5. On `[REJECTED]` detection:
   - Remove: status update to 'rejected'
   - Add: card move to `TRIAGE_COLUMNS.REJECTED`

6. On question/needs_info:
   - Remove: status update to 'needs_info'
   - The card stays in `INTERVIEWING` — needs_info is derived from conversation status

7. On error rollback:
   - Remove: status rollback to 'new'
   - Move card back to `TRIAGE_COLUMNS.NEW`

8. In `createBugCard()`: replace `BUG_BOARD_ID` with `BOARD_IDS.TRIAGE`, `BUG_COLUMNS.NEW` with `TRIAGE_COLUMNS.NEW`.

9. In `listReports()` / `getReport()`: remove any `status` from SELECT if it was explicitly listed, or leave `SELECT *` as is (the column no longer exists).

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/bug-triage.ts
git commit -m "refactor: remove status sync from bug-triage service — column is source of truth"
```

---

### Task 6: Backend — Simplify Bug Report Routes

**Files:**
- Modify: `packages/api/src/routes/bug-reports.ts`

- [ ] **Step 1: Update bug-reports.ts**

1. Replace import: `BUG_BOARD_ID, BUG_COLUMNS` → `BOARD_IDS, TRIAGE_COLUMNS`

2. In `GET /api/bug-reports`: remove the `?status=` filter parameter. Instead, the list derives state from the card's column:
   ```typescript
   const reports = db.prepare(`
     SELECT br.*, c.column_id, c.board_id
     FROM bug_reports br
     LEFT JOIN cards c ON c.id = br.card_id
     ORDER BY br.created_at DESC
   `).all()
   ```

3. In `POST /api/bug-reports` (create): remove `status: 'new'` from the INSERT. Use `BOARD_IDS.TRIAGE` and `TRIAGE_COLUMNS.NEW` instead of `BUG_BOARD_ID` and `BUG_COLUMNS.NEW`.

4. In `POST /api/bug-reports/:id/respond`: remove status updates (`needs_info`, `triaging`).

5. Remove `POST /api/bug-reports/:id/create-card` (legacy endpoint — card is auto-created on POST).

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/bug-reports.ts
git commit -m "refactor: remove status management from bug-report routes"
```

---

### Task 7: Backend — Simplify Spec Routes

**Files:**
- Modify: `packages/api/src/routes/specs.ts`

- [ ] **Step 1: Update specs.ts**

1. Remove import of `SPEC_STATUSES`.

2. In `GET /api/specs`: remove `?status=` filter. Join with cards to get column info:
   ```typescript
   const specs = db.prepare(`
     SELECT s.*, c.column_id, c.board_id
     FROM specs s
     LEFT JOIN cards c ON c.id = s.card_id
     ORDER BY s.updated_at DESC
   `).all()
   ```

3. In `POST /api/specs` (create): also create a card in Spec board:
   ```typescript
   const cardId = crypto.randomUUID()
   db.prepare(
     'INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES (?, ?, ?, \'task\', ?, 0, datetime(\'now\'), datetime(\'now\'))'
   ).run(cardId, BOARD_IDS.SPEC, SPEC_COLUMNS.IDEAS, title)
   
   // Use cardId in specs INSERT instead of source_card_id
   ```

4. In `POST /api/specs/:id/review`:
   - On `approve`: move card to `SPEC_COLUMNS.APPROVED` (instead of setting status)
   - On `reject`: move card back to `SPEC_COLUMNS.DRAFTING` (instead of setting status)
   - Remove: `db.prepare('UPDATE specs SET status = ?...')`

5. In `POST /api/specs/generate`: create a card in `SPEC_COLUMNS.DRAFTING` and link via `card_id`.

6. In `POST /api/specs/:id/decompose`: 
   - Remove: check for `status === 'approved'`
   - Add: check that card is in `SPEC_COLUMNS.APPROVED` column
   - When creating child cards, create them in `DEV_COLUMNS.TODO` on `BOARD_IDS.DEV` with `parent_card_id` pointing to the spec's card.

7. Replace all `source_card_id` references with `card_id` in SQL queries.

- [ ] **Step 2: Add imports**

```typescript
import { BOARD_IDS, SPEC_COLUMNS, DEV_COLUMNS } from '@gaud/shared'
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/specs.ts
git commit -m "refactor: specs use card column as state — remove status field"
```

---

### Task 8: Backend — Simplify Execution Routes

**Files:**
- Modify: `packages/api/src/routes/executions.ts`

- [ ] **Step 1: Rewrite executions.ts for run-log model**

Replace the entire content of `packages/api/src/routes/executions.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection'
import { broadcast } from '../ws/broadcast'
import crypto from 'crypto'

export function executionRoutes(app: FastifyInstance) {
  // List executions (run log) for a card
  app.get<{ Querystring: { cardId?: string } }>('/api/executions', async (req) => {
    const db = getDb()
    const { cardId } = req.query as any
    if (cardId) {
      return db.prepare('SELECT * FROM executions WHERE card_id = ? ORDER BY started_at DESC').all(cardId)
    }
    return db.prepare('SELECT * FROM executions ORDER BY started_at DESC LIMIT 50').all()
  })

  // Get single execution
  app.get<{ Params: { id: string } }>('/api/executions/:id', async (req, reply) => {
    const db = getDb()
    const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id)
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })
    return execution
  })

  // Create a new execution run for a card
  app.post<{ Body: { cardId: string; branch?: string } }>('/api/executions', async (req) => {
    const db = getDb()
    const { cardId, branch } = req.body as any
    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO executions (id, card_id, branch, started_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(id, cardId, branch || null)
    broadcast('execution:updated', { id, cardId })
    return { id }
  })

  // Complete an execution
  app.post<{ Params: { id: string }; Body: { outcome: 'success' | 'failed'; prUrl?: string } }>(
    '/api/executions/:id/complete',
    async (req, reply) => {
      const db = getDb()
      const { outcome, prUrl } = req.body as any
      const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any
      if (!execution) return reply.status(404).send({ error: 'Execution not found' })

      db.prepare(
        'UPDATE executions SET finished_at = datetime(\'now\'), outcome = ?, pr_url = ? WHERE id = ?'
      ).run(outcome, prUrl || null, req.params.id)

      broadcast('execution:updated', { id: req.params.id, cardId: execution.card_id, outcome })
      return { success: true }
    }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/executions.ts
git commit -m "refactor: executions as simple run-log — no status machine"
```

---

### Task 9: Backend — Remove column-action.ts + Setup Board Creation

**Files:**
- Delete: `packages/api/src/services/column-action.ts`
- Modify: `packages/api/src/routes/setup.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Delete column-action.ts**

```bash
rm packages/api/src/services/column-action.ts
```

- [ ] **Step 2: Remove Development board creation from setup.ts**

In `packages/api/src/routes/setup.ts`, find the `POST /api/setup/complete` handler. Remove the block that creates the Development board and its columns (approximately lines that do `INSERT INTO boards` with name 'Development' and the subsequent column INSERTs with Backlog/Spec/Review/Approved/Executing/Done). The 3 fixed boards already exist from migration 011.

- [ ] **Step 3: Remove column-action imports from any file**

Search for imports of `column-action` or `executeColumnAction` in the codebase and remove them:
```bash
grep -r "column-action\|executeColumnAction" packages/api/src/ --include="*.ts" -l
```

For each file found, remove the import and any calls to `executeColumnAction`.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`
Expected: 0 errors (all removed references cleaned up)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove column-action engine and setup board creation"
```

---

### Task 10: Backend — Update Execution Engine

**Files:**
- Modify: `packages/api/src/services/execution-engine.ts`

- [ ] **Step 1: Update ExecutionEngine to operate on cards**

This is a large file (541 lines). Key changes:

1. Replace imports: use `BOARD_IDS, DEV_COLUMNS` from `@gaud/shared`.

2. `startExecution()`:
   - Instead of updating `executions.status = 'executing'`, the execution is already created as a run-log entry with no `finished_at`.
   - Move the card to `DEV_COLUMNS.IN_PROGRESS`.
   - Instead of `scheduleNextTasks()` which iterates execution_tasks, operate on the single card directly.

3. Remove all `execution_tasks` queries:
   - `getExecutableTasks()` — remove (no tasks table)
   - Task status updates (`UPDATE execution_tasks SET status = ...`) — remove

4. On completion:
   - Set `executions.finished_at = datetime('now')`, `outcome = 'success'`, `pr_url = ...`
   - Move card to `DEV_COLUMNS.REVIEW` if PR opened, or `DEV_COLUMNS.DONE` if no PR needed.

5. On failure:
   - Set `executions.finished_at = datetime('now')`, `outcome = 'failed'`
   - Move card back to `DEV_COLUMNS.TODO` with error comment.

6. Remove `resolveGapAndResume()` — gaps table no longer exists. Questions go through the card's conversation.

7. `createPR()` — keep but update to write `pr_url` to executions table instead of execution_tasks.

**Note:** This task requires careful refactoring. The execution engine is the most complex service. If the current engine is too entangled with execution_tasks, consider a fresh rewrite that:
- Takes a card ID
- Creates a run-log entry in executions
- Moves card to In Progress
- Spawns provider session
- On success: creates PR, records pr_url/branch, moves to Review
- On failure: records outcome, moves to To Do

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @gaud/api typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/execution-engine.ts
git commit -m "refactor: execution engine operates on cards directly — no execution_tasks"
```

---

### Task 11: Frontend — Fixed Board Navigation

**Files:**
- Modify: `packages/web/src/pages/BoardListPage.tsx`

- [ ] **Step 1: Replace BoardListPage with fixed navigation**

Replace the entire content of `packages/web/src/pages/BoardListPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ClipboardCheck, Lightbulb, Code2 } from 'lucide-react'
import { BOARD_IDS } from '@gaud/shared'

const BOARDS = [
  {
    id: BOARD_IDS.TRIAGE,
    name: 'Triage',
    description: 'Bug reports: intake, interview, and triage',
    icon: ClipboardCheck,
    color: '#F59E0B',
  },
  {
    id: BOARD_IDS.SPEC,
    name: 'Spec',
    description: 'Feature specs: ideation, drafting, review, and approval',
    icon: Lightbulb,
    color: '#8B5CF6',
  },
  {
    id: BOARD_IDS.DEV,
    name: 'Dev',
    description: 'Development: tasks from triage and specs through to completion',
    icon: Code2,
    color: '#10B981',
  },
] as const

export default function BoardListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Boards</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BOARDS.map((board) => {
          const Icon = board.icon
          return (
            <Link
              key={board.id}
              to={`/boards/${board.id}`}
              className="flex items-start gap-4 p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${board.color}20`, color: board.color }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {board.name}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {board.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/BoardListPage.tsx
git commit -m "refactor: BoardListPage shows 3 fixed boards — no more board creation"
```

---

### Task 12: Frontend — Update BoardViewPage

**Files:**
- Modify: `packages/web/src/pages/BoardViewPage.tsx`

- [ ] **Step 1: Remove Settings link from BoardViewPage header**

In `packages/web/src/pages/BoardViewPage.tsx`, remove the `<Link to={/boards/${id}/settings}>` element and its Settings icon/button from the header bar. Keep the Gantt link if desired (it's frozen, not deleted).

Also remove the "New Board" creation modal if it exists in this page (it doesn't — that's in BoardListPage, but verify).

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/BoardViewPage.tsx
git commit -m "refactor: remove Settings link from BoardViewPage"
```

---

### Task 13: Frontend — Update BugReportPage

**Files:**
- Modify: `packages/web/src/pages/BugReportPage.tsx`

- [ ] **Step 1: Update BugReportPage to use new constants**

1. Replace import: `BUG_BOARD_ID` → `BOARD_IDS` from `@gaud/shared`.
2. Replace `BUG_BOARD_ID` usage with `BOARD_IDS.TRIAGE`.
3. Remove `statusConfig` mapping — status is derived from card column now.
4. In list view: instead of showing a status badge, show the card's column name (from the board data already fetched).
5. Remove `ViewMode` toggle if the board view is now the primary (or keep both — user preference).

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/BugReportPage.tsx
git commit -m "refactor: BugReportPage uses BOARD_IDS.TRIAGE — no status badges"
```

---

### Task 14: Frontend — Update BugReportDetailPage

**Files:**
- Modify: `packages/web/src/pages/BugReportDetailPage.tsx`

- [ ] **Step 1: Update BugReportDetailPage**

1. Replace import: `BUG_BOARD_ID` → `BOARD_IDS`, add `TRIAGE_COLUMNS, DEV_COLUMNS, SPEC_COLUMNS`.

2. Remove `statusConfig` and `statusBadgeVariant` — status is derived from the card's column.

3. Derive state from card column: fetch the card to get its `columnId`, then display the column name as the state badge.

4. Replace "Assign to Development" section (shown when `status === 'triaged'`) with two action buttons:
   - "Send to Development" — calls `POST /api/cards/:cardId/send-to-dev`
   - "Send to Spec" — calls `POST /api/cards/:cardId/send-to-spec`
   
   Show these when the card is in `TRIAGE_COLUMNS.TRIAGED`.

5. Replace "Start Triage" / "Retry Triage" button logic:
   - Show "Start Triage" when card is in `TRIAGE_COLUMNS.NEW`
   - Show "Continue Triage" when card is in `TRIAGE_COLUMNS.INTERVIEWING`

6. Remove the board/column dropdown selectors (no more arbitrary board assignment). The handoff endpoints handle the move.

7. Add a confirmation dialog for "Send to Development" and "Send to Spec" actions.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/BugReportDetailPage.tsx
git commit -m "refactor: BugReportDetailPage uses column state + handoff actions"
```

---

### Task 15: Frontend — Update API Client

**Files:**
- Modify: `packages/web/src/api/client.ts`

- [ ] **Step 1: Add handoff methods, remove board CRUD**

In `packages/web/src/api/client.ts`:

1. Remove board CRUD methods: `createBoard`, `updateBoard`, `deleteBoard`, `createColumn`, `updateColumn`, `deleteColumn` (if they exist).

2. Add card handoff methods:
   ```typescript
   cards: {
     // ... existing methods ...
     sendToDev: (cardId: string) => 
       fetchApi(`/api/cards/${cardId}/send-to-dev`, { method: 'POST' }),
     sendToSpec: (cardId: string) =>
       fetchApi(`/api/cards/${cardId}/send-to-spec`, { method: 'POST' }),
     reopen: (cardId: string, reason?: string) =>
       fetchApi(`/api/cards/${cardId}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
   }
   ```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat: add card handoff API methods, remove board CRUD methods"
```

---

### Task 16: Frontend — Remove BoardSettingsPage + Update Routing

**Files:**
- Delete: `packages/web/src/pages/BoardSettingsPage.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Delete BoardSettingsPage**

```bash
rm packages/web/src/pages/BoardSettingsPage.tsx
```

- [ ] **Step 2: Update App.tsx routing**

In `packages/web/src/App.tsx`:

1. Remove the import of `BoardSettingsPage`.
2. Remove the route: `<Route path="/boards/:id/settings" element={<BoardSettingsPage />} />`
3. Update WebSocket event handlers if any reference old event types.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @gaud/web typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove BoardSettingsPage and settings route"
```

---

### Task 17: Dead Code Cleanup + Verification

**Files:**
- All packages

- [ ] **Step 1: Grep for dead references**

Run each grep and fix any remaining references:

```bash
grep -r "BUG_COLUMNS\|BUG_BOARD_ID" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "SPEC_STATUSES\|EXECUTION_STATUSES" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "agent_action_prompt\|auto_move\|role_required" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "execution_tasks\|execution_gaps" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "column-action\|executeColumnAction" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "BoardSettingsPage" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "bug_reports\.status\|report\.status\|status.*triaging\|status.*needs_info" packages/ --include="*.ts" --include="*.tsx" -l
grep -r "specs\.status\|spec\.status.*draft\|SpecStatus" packages/ --include="*.ts" --include="*.tsx" -l
```

Expected: All greps return 0 results (excluding migration files and this plan).

- [ ] **Step 2: Fix any remaining references found in Step 1**

For each file with dead references, update the code to use the new constants/types.

- [ ] **Step 3: Full typecheck across all packages**

```bash
pnpm typecheck
```
Expected: 0 errors across all packages.

- [ ] **Step 4: Start the server and verify**

```bash
pnpm dev
```

Verify:
1. Server starts without errors
2. Migration 011 applies (or was already applied)
3. Navigate to `/boards` — see 3 fixed board cards
4. Click each board — see the correct columns
5. Navigate to `/bugs` — bug reports load with Triage board
6. No console errors in browser

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: clean up dead references to old board/status system"
```

---
