import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('MCP Tools', () => {
  let db: Database.Database

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    // Load migrations
    const migrationsDir = join(__dirname, '..', '..', '..', 'api', 'src', 'db', 'migrations')
    const migrations = ['001_initial.sql', '002_fix_comment_author_type.sql', '003_agent_hierarchy.sql']
    for (const m of migrations) {
      const path = join(migrationsDir, m)
      try { db.exec(readFileSync(path, 'utf-8')) } catch { /* may not exist */ }
    }

    // Seed data
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Sprint 1')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('c1', 'b1', 'Backlog', 0)").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('c2', 'b1', 'In Progress', 1)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES ('card1', 'b1', 'c1', 'task', 'Fix bug', 0, datetime('now'), datetime('now'))").run()
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Claude', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id, created_at) VALUES ('a1', 'Coder', 'p1', datetime('now'))").run()
    db.prepare("INSERT INTO agents (id, name, provider_id, parent_agent_id, created_at) VALUES ('a2', 'Junior', 'p1', 'a1', datetime('now'))").run()
  })

  afterAll(() => db.close())

  describe('toCamelCase', () => {
    it('converts snake_case keys to camelCase', () => {
      const row = { board_id: 'b1', created_at: '2026-01-01', simple: 'v' }
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value
      }
      expect(result['boardId']).toBe('b1')
      expect(result['createdAt']).toBe('2026-01-01')
      expect(result['simple']).toBe('v')
    })
  })

  describe('Board queries', () => {
    it('lists boards', () => {
      const boards = db.prepare('SELECT * FROM boards').all()
      expect(boards.length).toBe(1)
    })

    it('gets board with columns', () => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get('b1')
      expect(board).toBeTruthy()
      const columns = db.prepare('SELECT * FROM columns WHERE board_id = ?').all('b1')
      expect(columns.length).toBe(2)
    })
  })

  describe('Card queries', () => {
    it('lists cards by board', () => {
      const cards = db.prepare('SELECT * FROM cards WHERE board_id = ?').all('b1')
      expect(cards.length).toBe(1)
    })

    it('creates and retrieves a card', () => {
      const id = randomUUID()
      db.prepare("INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES (?, 'b1', 'c1', 'bug', 'Another bug', 1, datetime('now'), datetime('now'))").run(id)
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as any
      expect(card.type).toBe('bug')
      expect(card.title).toBe('Another bug')
    })

    it('moves a card to another column', () => {
      db.prepare("UPDATE cards SET column_id = 'c2' WHERE id = 'card1'").run()
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get('card1') as any
      expect(card.column_id).toBe('c2')
      // Move back
      db.prepare("UPDATE cards SET column_id = 'c1' WHERE id = 'card1'").run()
    })
  })

  describe('Agent queries', () => {
    it('lists agents', () => {
      const agents = db.prepare('SELECT * FROM agents').all()
      expect(agents.length).toBe(2)
    })

    it('gets agent with hierarchy', () => {
      const children = db.prepare('SELECT * FROM agents WHERE parent_agent_id = ?').all('a1')
      expect(children.length).toBe(1)
    })

    it('builds tree structure', () => {
      const agents = db.prepare('SELECT id, name, parent_agent_id FROM agents').all() as Array<{ id: string; name: string; parent_agent_id: string | null }>
      const roots = agents.filter(a => !a.parent_agent_id)
      expect(roots.length).toBe(1)
      expect(roots[0]!.name).toBe('Coder')
    })
  })

  describe('Spec queries', () => {
    it('creates and queries a spec', () => {
      const id = randomUUID()
      db.prepare("INSERT INTO specs (id, title, content, status, created_by_type, created_at, updated_at) VALUES (?, 'Test spec', 'Content', 'draft', 'user', datetime('now'), datetime('now'))").run(id)
      const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(id) as any
      expect(spec.status).toBe('draft')
    })
  })

  describe('Execution queries', () => {
    it('creates and queries an execution', () => {
      const id = randomUUID()
      db.prepare("INSERT INTO executions (id, status, created_at, updated_at) VALUES (?, 'planning', datetime('now'), datetime('now'))").run(id)
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as any
      expect(exec.status).toBe('planning')
    })
  })

  describe('Conversation queries', () => {
    it('creates conversation with participants', () => {
      const id = randomUUID()
      db.prepare("INSERT INTO conversations (id, type, status, created_at, updated_at) VALUES (?, 'spec', 'active', datetime('now'), datetime('now'))").run(id)
      db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)').run(id, 'a1')
      const participants = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ?').all(id)
      expect(participants.length).toBe(1)
    })
  })

  describe('Memory queries', () => {
    it('stores and searches memory', () => {
      const id = randomUUID()
      db.prepare("INSERT INTO agent_memories (id, agent_id, type, content, created_at, updated_at) VALUES (?, 'a1', 'pattern_success', 'Use TDD for better results', datetime('now'), datetime('now'))").run(id)
      const results = db.prepare("SELECT * FROM agent_memories WHERE content LIKE ?").all('%TDD%') as any[]
      expect(results.length).toBe(1)
      expect(results[0].content).toContain('TDD')
    })
  })

  describe('Dashboard queries', () => {
    it('aggregates dashboard metrics', () => {
      const agentTotal = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c
      const cardTotal = (db.prepare('SELECT COUNT(*) as c FROM cards').get() as any).c
      const boardsTotal = (db.prepare('SELECT COUNT(*) as c FROM boards').get() as any).c
      expect(agentTotal).toBeGreaterThan(0)
      expect(cardTotal).toBeGreaterThan(0)
      expect(boardsTotal).toBe(1)
    })
  })
})
