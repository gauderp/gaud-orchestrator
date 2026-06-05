-- SQLite não suporta ALTER CHECK, precisa recriar a tabela
PRAGMA foreign_keys = OFF;

CREATE TABLE card_comments_new (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent', 'system')),
  author_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO card_comments_new SELECT * FROM card_comments;

DROP TABLE card_comments;

ALTER TABLE card_comments_new RENAME TO card_comments;

PRAGMA foreign_keys = ON;
