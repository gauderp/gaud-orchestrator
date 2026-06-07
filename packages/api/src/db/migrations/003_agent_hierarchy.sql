-- Agent hierarchy: parent approval and escalation settings
ALTER TABLE agents ADD COLUMN requires_parent_approval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN escalation_timeout_minutes INTEGER NOT NULL DEFAULT 30;

-- Track reviews between parent/child agents
CREATE TABLE agent_reviews (
  id TEXT PRIMARY KEY,
  execution_task_id TEXT REFERENCES execution_tasks(id),
  conversation_id TEXT REFERENCES conversations(id),
  reviewer_agent_id TEXT NOT NULL REFERENCES agents(id),
  reviewee_agent_id TEXT NOT NULL REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')) DEFAULT 'pending',
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_agent_reviews_task ON agent_reviews(execution_task_id);
CREATE INDEX idx_agent_reviews_reviewer ON agent_reviews(reviewer_agent_id);
