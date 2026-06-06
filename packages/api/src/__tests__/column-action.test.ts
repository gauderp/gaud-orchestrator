import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Column Action', () => {
  let db: Database.Database

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '002_fix_comment_author_type.sql'), 'utf-8'))

    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Claude', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a1', 'Coder', 'p1')").run()
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Board')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position, agent_action_prompt, auto_move) VALUES ('col1', 'b1', 'Spec', 0, 'Generate a spec', 0)").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('col2', 'b1', 'Review', 1)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title, assigned_agent_id) VALUES ('c1', 'b1', 'col1', 'task', 'NFS-e', 'a1')").run()
  })

  afterAll(() => db.close())

  it('creates a conversation when column has agent_action_prompt', async () => {
    const { executeColumnAction } = await import('../services/column-action.js')
    await executeColumnAction(db, 'c1', {
      id: 'col1', name: 'Spec', agent_action_prompt: 'Generate a spec',
      auto_move: 0, board_id: 'b1',
    }, null)

    const convs = db.prepare('SELECT * FROM conversations WHERE card_id = ?').all('c1') as any[]
    expect(convs.length).toBe(1)
    expect(convs[0].type).toBe('spec')
  })

  it('adds agent as participant', async () => {
    const convs = db.prepare('SELECT * FROM conversations WHERE card_id = ?').all('c1') as any[]
    const participants = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ?').all(convs[0].id) as any[]
    expect(participants.length).toBe(1)
    expect(participants[0].agent_id).toBe('a1')
  })

  it('seeds conversation with column prompt as system message', async () => {
    const convs = db.prepare('SELECT * FROM conversations WHERE card_id = ?').all('c1') as any[]
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').all(convs[0].id) as any[]
    expect(messages.length).toBe(1)
    expect(messages[0].sender_type).toBe('system')
    expect(messages[0].content).toContain('Generate a spec')
  })

  it('falls back to first agent if card has no assigned agent', async () => {
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c2', 'b1', 'col1', 'task', 'Unassigned')").run()
    const { executeColumnAction } = await import('../services/column-action.js')
    await executeColumnAction(db, 'c2', {
      id: 'col1', name: 'Spec', agent_action_prompt: 'Generate a spec',
      auto_move: 0, board_id: 'b1',
    }, null)

    const convs = db.prepare('SELECT * FROM conversations WHERE card_id = ?').all('c2') as any[]
    expect(convs.length).toBe(1)
    const participants = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ?').all(convs[0].id) as any[]
    expect(participants[0].agent_id).toBe('a1')
  })

  it('creates execution when prompt contains execute keyword', async () => {
    // Create an approved spec for c1
    db.prepare("INSERT INTO specs (id, title, content, status, source_card_id, created_by_type) VALUES ('s1', 'Spec', 'content', 'approved', 'c1', 'agent')").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title, assigned_agent_id) VALUES ('c3', 'b1', 'col1', 'task', 'Execute', 'a1')").run()
    db.prepare("INSERT INTO specs (id, title, content, status, source_card_id, created_by_type) VALUES ('s2', 'Spec2', 'content2', 'approved', 'c3', 'agent')").run()

    const { executeColumnAction } = await import('../services/column-action.js')
    await executeColumnAction(db, 'c3', {
      id: 'col1', name: 'Execute', agent_action_prompt: 'Execute the approved spec',
      auto_move: 0, board_id: 'b1',
    }, null)

    const execs = db.prepare('SELECT * FROM executions WHERE card_id = ?').all('c3') as any[]
    expect(execs.length).toBe(1)
  })

  it('auto-moves card to next column when auto_move is enabled', async () => {
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title, assigned_agent_id) VALUES ('c4', 'b1', 'col1', 'task', 'AutoMove', 'a1')").run()

    const { executeColumnAction } = await import('../services/column-action.js')
    await executeColumnAction(db, 'c4', {
      id: 'col1', name: 'Spec', agent_action_prompt: 'Generate a spec',
      auto_move: 1, board_id: 'b1',
    }, null)

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get('c4') as any
    expect(card.column_id).toBe('col2')
  })
})
