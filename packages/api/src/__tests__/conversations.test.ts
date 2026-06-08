import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { conversationRoutes } from '../routes/conversations.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { setupTestAuth } from './helpers/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Conversations API', () => {
  const app = Fastify()
  let db: Database.Database
  let convId: string

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))

    // Seed: provider, agent, board, card
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Test', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a1', 'Fiscal', 'p1')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a2', 'Coder', 'p1')").run()
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Board')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('col1', 'b1', 'Backlog', 0)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'b1', 'col1', 'task', 'NFS-e')").run()

    app.decorate('db', db)
    await setupTestAuth(app)
    await app.register(conversationRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/conversations creates with participants', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/conversations',
      payload: { cardId: 'c1', type: 'spec', agentIds: ['a1', 'a2'] },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.type).toBe('spec')
    expect(body.participants.length).toBe(2)
    convId = body.id
  })

  it('GET /api/conversations/:id returns with messages', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/conversations/${convId}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.messages).toBeDefined()
    expect(body.participants).toBeDefined()
  })

  it('POST /api/conversations/:id/messages adds user message', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/conversations/${convId}/messages`,
      payload: { content: 'Please analyze the NFS-e requirements.' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).senderType).toBe('user')
  })

  it('GET /api/conversations/:id/messages lists messages', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/conversations/${convId}/messages` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('POST /api/conversations/:id/add-agent adds participant', async () => {
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a3', 'Reviewer', 'p1')").run()
    const res = await app.inject({
      method: 'POST', url: `/api/conversations/${convId}/add-agent`,
      payload: { agentId: 'a3' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST /api/conversations/:id/resume resumes paused conversation', async () => {
    db.prepare('UPDATE conversations SET status = ? WHERE id = ?').run('paused_for_user', convId)
    const res = await app.inject({
      method: 'POST', url: `/api/conversations/${convId}/resume`,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).status).toBe('active')
  })

  it('POST /api/conversations/:id/pause pauses conversation', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/conversations/${convId}/pause`,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).status).toBe('paused_for_user')
  })

  it('GET /api/cards/:cardId/conversations lists for card', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards/c1/conversations' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).length).toBe(1)
  })
})
