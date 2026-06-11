-- Migration 011: Simplify boards
-- Replaces N user-created boards + status-synced entities with 3 fixed boards
-- where the column IS the single source of truth for work state.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. Create the 3 fixed boards
-- ============================================================
INSERT OR IGNORE INTO boards (id, name) VALUES
  ('triage-board', 'Triage'),
  ('spec-board', 'Spec'),
  ('dev-board', 'Dev');

-- ============================================================
-- 2. Create fixed columns for each board
--    (table still has agent_action_prompt, auto_move, role_required at this point)
-- ============================================================
INSERT OR IGNORE INTO columns (id, board_id, name, color, position, agent_action_prompt, auto_move, role_required) VALUES
  -- Triage board
  ('triage-col-new',           'triage-board', 'New',          '#3B82F6', 0, NULL, 0, NULL),
  ('triage-col-interviewing',  'triage-board', 'Interviewing', '#F59E0B', 1, NULL, 0, NULL),
  ('triage-col-triaged',       'triage-board', 'Triaged',      '#8B5CF6', 2, NULL, 0, NULL),
  ('triage-col-rejected',      'triage-board', 'Rejected',     '#EF4444', 3, NULL, 0, NULL),
  -- Spec board
  ('spec-col-ideas',           'spec-board',   'Ideas',        '#3B82F6', 0, NULL, 0, NULL),
  ('spec-col-drafting',        'spec-board',   'Drafting',     '#F59E0B', 1, NULL, 0, NULL),
  ('spec-col-review',          'spec-board',   'Review',       '#8B5CF6', 2, NULL, 0, NULL),
  ('spec-col-approved',        'spec-board',   'Approved',     '#10B981', 3, NULL, 0, NULL),
  -- Dev board
  ('dev-col-todo',             'dev-board',    'To Do',        '#3B82F6', 0, NULL, 0, NULL),
  ('dev-col-progress',         'dev-board',    'In Progress',  '#F59E0B', 1, NULL, 0, NULL),
  ('dev-col-review',           'dev-board',    'Review',       '#8B5CF6', 2, NULL, 0, NULL),
  ('dev-col-done',             'dev-board',    'Done',         '#10B981', 3, NULL, 0, NULL);

-- ============================================================
-- 3. Migrate cards from old bug board to new boards
-- ============================================================
UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-new'
  WHERE column_id = 'bug-col-new';

UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-interviewing'
  WHERE column_id = 'bug-col-triaging';

UPDATE cards SET board_id = 'triage-board', column_id = 'triage-col-triaged'
  WHERE column_id = 'bug-col-triaged';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-progress'
  WHERE column_id = 'bug-col-progress';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-review'
  WHERE column_id = 'bug-col-testing';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE column_id = 'bug-col-reopened';

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-done'
  WHERE column_id = 'bug-col-done';

-- ============================================================
-- 4. Migrate cards from setup-created Development boards to dev board
--    Match by column name
-- ============================================================
UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE column_id IN (
    SELECT c.id FROM columns c
    JOIN boards b ON c.board_id = b.id
    WHERE b.id NOT IN ('triage-board', 'spec-board', 'dev-board', 'bug-triage-board')
      AND c.name = 'To Do'
  );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-progress'
  WHERE column_id IN (
    SELECT c.id FROM columns c
    JOIN boards b ON c.board_id = b.id
    WHERE b.id NOT IN ('triage-board', 'spec-board', 'dev-board', 'bug-triage-board')
      AND c.name = 'In Progress'
  );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-review'
  WHERE column_id IN (
    SELECT c.id FROM columns c
    JOIN boards b ON c.board_id = b.id
    WHERE b.id NOT IN ('triage-board', 'spec-board', 'dev-board', 'bug-triage-board')
      AND c.name = 'Review'
  );

UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-done'
  WHERE column_id IN (
    SELECT c.id FROM columns c
    JOIN boards b ON c.board_id = b.id
    WHERE b.id NOT IN ('triage-board', 'spec-board', 'dev-board', 'bug-triage-board')
      AND c.name = 'Done'
  );

-- ============================================================
-- 5. Catch-all: remaining cards on non-fixed boards → dev-col-todo
-- ============================================================
UPDATE cards SET board_id = 'dev-board', column_id = 'dev-col-todo'
  WHERE board_id NOT IN ('triage-board', 'spec-board', 'dev-board');

-- ============================================================
-- 6. Create cards for existing specs
-- ============================================================
-- Specs WITH source_card_id: move the card to spec board
-- Map spec status to column
UPDATE cards SET board_id = 'spec-board', column_id = 'spec-col-drafting'
  WHERE id IN (SELECT source_card_id FROM specs WHERE source_card_id IS NOT NULL AND status = 'draft');

UPDATE cards SET board_id = 'spec-board', column_id = 'spec-col-review'
  WHERE id IN (SELECT source_card_id FROM specs WHERE source_card_id IS NOT NULL AND status = 'review');

UPDATE cards SET board_id = 'spec-board', column_id = 'spec-col-approved'
  WHERE id IN (SELECT source_card_id FROM specs WHERE source_card_id IS NOT NULL AND status = 'approved');

UPDATE cards SET board_id = 'spec-board', column_id = 'spec-col-ideas'
  WHERE id IN (SELECT source_card_id FROM specs WHERE source_card_id IS NOT NULL AND status = 'rejected');

-- Specs WITHOUT source_card_id: create card with deterministic ID
INSERT OR IGNORE INTO cards (id, board_id, column_id, type, title, description, position, created_at, updated_at)
  SELECT
    'spec-card-' || s.id,
    'spec-board',
    CASE s.status
      WHEN 'draft' THEN 'spec-col-drafting'
      WHEN 'review' THEN 'spec-col-review'
      WHEN 'approved' THEN 'spec-col-approved'
      ELSE 'spec-col-ideas'
    END,
    'task',
    s.title,
    NULL,
    0,
    s.created_at,
    s.updated_at
  FROM specs s
  WHERE s.source_card_id IS NULL;

-- ============================================================
-- 7. Recreate bug_reports WITHOUT status column, source as free TEXT
-- ============================================================
-- First drop bug_report_attachments (FK to bug_reports)
DROP TABLE IF EXISTS bug_report_attachments;

CREATE TABLE bug_reports_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  card_id TEXT REFERENCES cards(id),
  conversation_id TEXT REFERENCES conversations(id),
  triage_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO bug_reports_new (id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, triage_summary, created_at, updated_at)
  SELECT id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, triage_summary, created_at, updated_at
  FROM bug_reports;

DROP TABLE bug_reports;
ALTER TABLE bug_reports_new RENAME TO bug_reports;

-- Recreate bug_report_attachments
CREATE TABLE bug_report_attachments (
  id TEXT PRIMARY KEY,
  bug_report_id TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  file_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bug_reports_card ON bug_reports(card_id);
CREATE INDEX idx_bug_report_attachments ON bug_report_attachments(bug_report_id);

-- ============================================================
-- 8. Recreate specs WITHOUT status, with card_id NOT NULL
-- ============================================================
CREATE TABLE specs_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO specs_new (id, title, content, card_id, version, created_by_type, created_by_id, created_at, updated_at)
  SELECT
    s.id,
    s.title,
    s.content,
    COALESCE(s.source_card_id, 'spec-card-' || s.id),
    s.version,
    s.created_by_type,
    s.created_by_id,
    s.created_at,
    s.updated_at
  FROM specs s;

DROP TABLE specs;
ALTER TABLE specs_new RENAME TO specs;

CREATE INDEX idx_specs_card ON specs(card_id);

-- ============================================================
-- 9. Recreate executions as run log
-- ============================================================
CREATE TABLE executions_new (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  outcome TEXT CHECK (outcome IN ('success', 'failed')),
  pr_url TEXT,
  branch TEXT
);

INSERT INTO executions_new (id, card_id, started_at, finished_at, outcome, pr_url, branch)
  SELECT
    id,
    card_id,
    created_at,
    CASE WHEN status IN ('done', 'failed') THEN updated_at ELSE NULL END,
    CASE
      WHEN status = 'done' THEN 'success'
      WHEN status = 'failed' THEN 'failed'
      ELSE NULL
    END,
    NULL,
    NULL
  FROM executions
  WHERE card_id IS NOT NULL;

DROP TABLE executions;
ALTER TABLE executions_new RENAME TO executions;

CREATE INDEX idx_executions_card ON executions(card_id);

-- ============================================================
-- 10. Drop execution_logs, execution_gaps, execution_tasks
-- ============================================================
DROP TABLE IF EXISTS execution_logs;
DROP TABLE IF EXISTS execution_gaps;
DROP TABLE IF EXISTS execution_tasks;

-- ============================================================
-- 11. Recreate columns WITHOUT agent_action_prompt, auto_move, role_required
--     Only keep fixed board columns
-- ============================================================
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

-- ============================================================
-- 12. Delete old boards
-- ============================================================
DELETE FROM boards WHERE id NOT IN ('triage-board', 'spec-board', 'dev-board');

-- Recreate indexes that were on the original columns table
CREATE INDEX idx_columns_board ON columns(board_id);

PRAGMA foreign_keys = ON;
