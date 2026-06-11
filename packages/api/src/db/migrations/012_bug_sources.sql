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
ALTER TABLE bug_reports ADD COLUMN source_id TEXT REFERENCES bug_sources(id) ON DELETE SET NULL;
ALTER TABLE bug_reports ADD COLUMN external_id TEXT;
ALTER TABLE bug_reports ADD COLUMN external_url TEXT;

-- Dedup index: same source + external ID = same bug
CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_reports_external
  ON bug_reports(source_id, external_id)
  WHERE external_id IS NOT NULL;
