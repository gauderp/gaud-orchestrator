import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { executionRoutes } from '../routes/executions.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { setupTestAuth } from './helpers/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Executions API', () => {
  const app = Fastify()
  let db: Database.Database
  let execId: string

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))

    // Seed
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Test', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a1', 'Coder', 'p1')").run()
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Board')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('col1', 'b1', 'Backlog', 0)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'b1', 'col1', 'task', 'Task')").run()

    // Create simplified executions table matching migration 011
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions_simple (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id),
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        outcome TEXT CHECK (outcome IN ('success', 'failed')),
        pr_url TEXT,
        branch TEXT
      )
    `)
    // Drop old executions and rename
    db.exec('DROP TABLE IF EXISTS executions')
    db.exec('ALTER TABLE executions_simple RENAME TO executions')

    ;(app as any).db = db
    await setupTestAuth(app)
    await app.register(executionRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/executions creates an execution', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/executions',
      payload: { cardId: 'c1', branch: 'feat/test' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.cardId).toBe('c1')
    expect(body.branch).toBe('feat/test')
    execId = body.id
  })

  it('GET /api/executions lists executions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/executions' })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/executions/:id returns an execution', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/executions/${execId}` })
    const body = JSON.parse(res.payload)
    expect(body.cardId).toBe('c1')
    expect(body.outcome).toBeNull()
  })

  it('POST /api/executions/:id/complete completes an execution', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/executions/${execId}/complete`,
      payload: { outcome: 'success', prUrl: 'https://github.com/pr/1' },
    })
    const body = JSON.parse(res.payload)
    expect(body.outcome).toBe('success')
    expect(body.prUrl).toBe('https://github.com/pr/1')
    expect(body.finishedAt).toBeTruthy()
  })
})
