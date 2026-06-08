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
    db.prepare("INSERT INTO specs (id, title, content, status, created_by_type) VALUES ('s1', 'Spec', '# Spec', 'approved', 'user')").run()

    ;(app as any).db = db
    await setupTestAuth(app)
    await app.register(executionRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/executions creates an execution', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/executions',
      payload: { cardId: 'c1', specId: 's1' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('planning')
    execId = body.id
  })

  it('GET /api/executions lists executions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/executions' })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/executions/:id returns with tasks and gaps', async () => {
    // Add a task manually
    db.prepare("INSERT INTO execution_tasks (id, execution_id, title, status) VALUES ('et1', ?, 'Build API', 'pending')").run(execId)
    const res = await app.inject({ method: 'GET', url: `/api/executions/${execId}` })
    const body = JSON.parse(res.payload)
    expect(body.tasks).toHaveLength(1)
    expect(body.gaps).toBeDefined()
  })

  it('POST /api/executions/:id/gaps/:gapId/resolve resolves a gap', async () => {
    db.prepare("INSERT INTO execution_gaps (id, execution_id, question, status) VALUES ('g1', ?, 'Which lib?', 'pending')").run(execId)
    const res = await app.inject({
      method: 'POST', url: `/api/executions/${execId}/gaps/g1/resolve`,
      payload: { response: 'Use jose' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/executions/:id/cancel cancels', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/executions/${execId}/cancel` })
    const body = JSON.parse(res.payload)
    if (res.statusCode !== 200) throw new Error(`Cancel failed with ${res.statusCode}: ${JSON.stringify(body)}`)
    expect(body.status).toBe('failed')
  })
})
