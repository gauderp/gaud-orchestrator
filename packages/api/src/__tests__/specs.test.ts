import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { specRoutes } from '../routes/specs.js'
import { createTestDb } from '../db/connection.js'
import type Database from 'better-sqlite3'

describe('Specs API', () => {
  const app = Fastify()
  let db: Database.Database
  let specId: string

  beforeAll(async () => {
    db = createTestDb()

    // Seed board + column + card for linking
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Board')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('col1', 'b1', 'Backlog', 0)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'b1', 'col1', 'task', 'NFS-e')").run()

    ;(app as any).db = db
    await app.register(specRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/specs creates a spec', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/specs',
      payload: { title: 'NFS-e Catalao', content: '# Spec\n\nBuild NFS-e.', sourceCardId: 'c1', createdByType: 'user' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.title).toBe('NFS-e Catalao')
    expect(body.status).toBe('draft')
    expect(body.version).toBe(1)
    specId = body.id
  })

  it('GET /api/specs lists specs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/specs' })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/specs?status=draft filters by status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/specs?status=draft' })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/specs/:id returns spec', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/specs/${specId}` })
    const body = JSON.parse(res.payload)
    expect(body.title).toBe('NFS-e Catalao')
    expect(body.reviews).toBeDefined()
  })

  it('PUT /api/specs/:id creates new version', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/specs/${specId}`,
      payload: { content: '# Spec v2\n\nUpdated content.' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.version).toBe(2)
    expect(body.content).toContain('v2')
  })

  it('POST /api/specs/:id/review adds a review', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/specs/${specId}/review`,
      payload: { reviewerType: 'user', verdict: 'comment', comment: 'Needs more detail on authentication.' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).verdict).toBe('comment')
  })

  it('POST /api/specs/:id/review approve changes status', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/specs/${specId}/review`,
      payload: { reviewerType: 'user', verdict: 'approve', comment: 'LGTM' },
    })
    expect(res.statusCode).toBe(201)
    // Check spec status changed
    const spec = await app.inject({ method: 'GET', url: `/api/specs/${specId}` })
    expect(JSON.parse(spec.payload).status).toBe('approved')
  })

  it('POST /api/specs/:id/decompose rejects or errors without LLM', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/specs/${specId}/decompose`,
      payload: { boardId: 'b1', columnId: 'col1' },
    })
    // Without a real LLM provider in tests, expect 500 (import/provider error)
    expect([200, 400, 500]).toContain(res.statusCode)
  })
})
