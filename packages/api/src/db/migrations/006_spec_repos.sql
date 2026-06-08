CREATE TABLE IF NOT EXISTS spec_repos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  repo_path TEXT NOT NULL,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spec_repos_spec ON spec_repos(spec_id);
