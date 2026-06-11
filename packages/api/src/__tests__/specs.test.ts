import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { specRoutes } from '../routes/specs.js'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/test-db.js'
import { setupTestAuth } from './helpers/auth.js'
import { SPEC_COLUMNS } from '@gaud/shared'

describe('Specs API', () => {
  const app = Fastify()
  let db: Database.Database
  let specId: string

  beforeAll(async () => {
    db = createTestDb()
    ;(app as any).db = db
    await setupTestAuth(app)
    await app.register(specRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/specs creates a spec with a card on the Spec board', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/specs',
      payload: { title: 'NFS-e Catalao', content: '# Spec\n\nBuild NFS-e.', createdByType: 'user' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.title).toBe('NFS-e Catalao')
    expect(body.version).toBe(1)
    expect(body.cardId).toBeDefined()
    specId = body.id

    // Card created in Spec: Ideas — column is the source of truth
    const card = db.prepare('SELECT board_id, column_id FROM cards WHERE id = ?').get(body.cardId) as any
    expect(card.board_id).toBe('spec-board')
    expect(card.column_id).toBe(SPEC_COLUMNS.IDEAS)
  })

  it('GET /api/specs lists specs with card column info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/specs' })
    const specs = JSON.parse(res.payload)
    expect(specs.length).toBe(1)
    expect(specs[0].columnId).toBe(SPEC_COLUMNS.IDEAS)
    expect(specs[0].boardId).toBe('spec-board')
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

  it('POST /api/specs/:id/review approve moves card to Approved', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/specs/${specId}/review`,
      payload: { reviewerType: 'user', verdict: 'approve', comment: 'LGTM' },
    })
    expect(res.statusCode).toBe(201)
    // Column is the source of truth — card must be in Approved
    const list = await app.inject({ method: 'GET', url: '/api/specs' })
    const spec = JSON.parse(list.payload).find((s: any) => s.id === specId)
    expect(spec.columnId).toBe(SPEC_COLUMNS.APPROVED)
  })

  it('POST /api/specs/:id/review reject moves card back to Drafting', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/specs/${specId}/review`,
      payload: { reviewerType: 'user', verdict: 'reject', comment: 'Missing edge cases' },
    })
    expect(res.statusCode).toBe(201)
    const list = await app.inject({ method: 'GET', url: '/api/specs' })
    const spec = JSON.parse(list.payload).find((s: any) => s.id === specId)
    expect(spec.columnId).toBe(SPEC_COLUMNS.DRAFTING)
  })

  it('POST /api/specs/:id/decompose rejects spec whose card is not in Approved', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/api/specs',
      payload: { title: 'Draft spec', content: '# Draft', createdByType: 'user' },
    })
    const draftId = JSON.parse(createRes.payload).id
    const res = await app.inject({ method: 'POST', url: `/api/specs/${draftId}/decompose`, payload: {} })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload).error).toContain('approved')
  })
})
