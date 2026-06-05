-- Providers
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  instructions TEXT,
  provider_id TEXT REFERENCES providers(id),
  model TEXT,
  cost_limit_usd REAL DEFAULT 0,
  parent_agent_id TEXT REFERENCES agents(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_cost_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  provider_id TEXT,
  model TEXT,
  task_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Skills
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- Boards
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  agent_action_prompt TEXT,
  auto_move INTEGER NOT NULL DEFAULT 0,
  role_required TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cards
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES columns(id),
  parent_card_id TEXT REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('project', 'epic', 'task', 'bug')),
  title TEXT NOT NULL,
  description TEXT,
  assigned_agent_id TEXT REFERENCES agents(id),
  estimated_tokens INTEGER,
  estimated_cost_usd REAL,
  position INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_dependencies (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  depends_on_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, depends_on_card_id)
);

CREATE TABLE card_repos (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  repo_path TEXT NOT NULL,
  spec_path TEXT
);

CREATE TABLE card_comments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent')),
  author_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_attachments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Specs
CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'rejected')) DEFAULT 'draft',
  source_card_id TEXT REFERENCES cards(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent')),
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE spec_reviews (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('user', 'agent')),
  reviewer_id TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'reject', 'comment')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Executions
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  spec_id TEXT REFERENCES specs(id),
  status TEXT NOT NULL CHECK (status IN ('planning', 'approving', 'executing', 'done', 'failed')) DEFAULT 'planning',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE execution_tasks (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  branch TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed', 'paused')) DEFAULT 'pending',
  agent_id TEXT REFERENCES agents(id),
  depends_on TEXT,
  pr_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE execution_gaps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  suggestion TEXT,
  response TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending'
);

CREATE TABLE execution_logs (
  id TEXT PRIMARY KEY,
  execution_task_id TEXT NOT NULL REFERENCES execution_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stdout', 'stderr', 'approval_request')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_cards_board ON cards(board_id);
CREATE INDEX idx_cards_column ON cards(column_id);
CREATE INDEX idx_cards_parent ON cards(parent_card_id);
CREATE INDEX idx_agent_cost_agent ON agent_cost_log(agent_id);
CREATE INDEX idx_agent_cost_created ON agent_cost_log(created_at);
CREATE INDEX idx_execution_tasks_exec ON execution_tasks(execution_id);
CREATE INDEX idx_execution_logs_task ON execution_logs(execution_task_id);
CREATE INDEX idx_specs_status ON specs(status);

-- ==========================================
-- Conversations
-- ==========================================
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('spec', 'plan', 'code', 'research', 'review')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused_for_user', 'completed')) DEFAULT 'active',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'user', 'system')),
  sender_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('content', 'question_for_agent', 'question_for_user', 'artifact')) DEFAULT 'content',
  mentions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- Agent Memory (long-term)
-- ==========================================
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  type TEXT NOT NULL CHECK (type IN ('conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  tags TEXT,
  embedding BLOB,
  relevance_score REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memory_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  conversation_id TEXT REFERENCES conversations(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  consolidated INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_conversations_card ON conversations(card_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(type);
CREATE INDEX idx_memory_sessions_agent ON memory_sessions(agent_id);
