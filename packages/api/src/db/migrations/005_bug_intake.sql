CREATE TABLE bug_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  source TEXT NOT NULL CHECK (source IN ('ui', 'slack', 'mcp')) DEFAULT 'ui',
  status TEXT NOT NULL CHECK (status IN ('new', 'triaging', 'needs_info', 'triaged', 'rejected')) DEFAULT 'new',
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  card_id TEXT REFERENCES cards(id),
  conversation_id TEXT REFERENCES conversations(id),
  triage_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bug_report_attachments (
  id TEXT PRIMARY KEY,
  bug_report_id TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  file_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_report_attachments ON bug_report_attachments(bug_report_id);
