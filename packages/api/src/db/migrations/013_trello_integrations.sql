-- Migration 013: Trello integrations (import-only)

CREATE TABLE trello_integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('bugs', 'dev')),
  trello_board_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_token TEXT NOT NULL,
  api_secret TEXT,                     -- OAuth secret da API key; usado no HMAC do webhook (opcional mas recomendado)
  -- target 'dev': { "listMapping": { "<trelloListId>": "<devColumnId>" } }
  -- target 'bugs': { "captureListIds": ["<trelloListId>", ...] }
  config_json TEXT NOT NULL DEFAULT '{}',
  webhook_secret TEXT NOT NULL,        -- token nosso na query string da callback URL
  trello_webhook_id TEXT,              -- id retornado pelo Trello ao registrar o webhook
  enabled INTEGER NOT NULL DEFAULT 1,
  last_backfill_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cards importados: rastreio de origem para dedup e sync
ALTER TABLE cards ADD COLUMN integration_id TEXT REFERENCES trello_integrations(id);
ALTER TABLE cards ADD COLUMN external_id TEXT;
ALTER TABLE cards ADD COLUMN external_url TEXT;

CREATE UNIQUE INDEX idx_cards_external
  ON cards(integration_id, external_id)
  WHERE external_id IS NOT NULL;

-- bug_sources type 'trello' é substituído por esta integração
UPDATE bug_sources SET enabled = 0 WHERE type = 'trello';
