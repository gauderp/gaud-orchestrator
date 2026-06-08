-- Central repo registry (not per-card, shared across the system)
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  github_url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  local_path TEXT,
  last_synced_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cloned', 'syncing', 'error')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_repositories_url ON repositories(github_url);

-- Update card_repos to reference repositories table
ALTER TABLE card_repos ADD COLUMN repository_id TEXT REFERENCES repositories(id);
