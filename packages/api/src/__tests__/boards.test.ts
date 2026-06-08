import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { boardRoutes } from '../routes/boards.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { setupTestAuth } from './helpers/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Boards API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    app.decorate('db', db)
    await setupTestAuth(app)
    await app.register(boardRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/boards creates a board', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/boards',
      payload: { name: 'Sprint 1' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).name).toBe('Sprint 1')
  })

  it('GET /api/boards lists boards', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards' })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/boards/:id returns board with columns', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/boards' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'GET', url: `/api/boards/${id}` })
    const body = JSON.parse(res.payload)
    expect(body.columns).toBeDefined()
    expect(Array.isArray(body.columns)).toBe(true)
  })

  it('POST /api/boards/:boardId/columns creates a column', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/boards' })
    const boardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/columns`,
      payload: { name: 'Backlog', color: '#64748b', position: 0 },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).name).toBe('Backlog')
  })

  it('PUT /api/columns/:id updates a column', async () => {
    const board = await app.inject({ method: 'GET', url: '/api/boards' })
    const boardId = JSON.parse(board.payload)[0].id
    const full = await app.inject({ method: 'GET', url: `/api/boards/${boardId}` })
    const colId = JSON.parse(full.payload).columns[0].id
    const res = await app.inject({
      method: 'PUT', url: `/api/columns/${colId}`,
      payload: { name: 'To Do', color: '#3b82f6', agentActionPrompt: 'Generate spec', autoMove: true },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).name).toBe('To Do')
    expect(JSON.parse(res.payload).agentActionPrompt).toBe('Generate spec')
  })

  it('PUT /api/boards/:boardId/columns/reorder reorders columns', async () => {
    const board = await app.inject({ method: 'GET', url: '/api/boards' })
    const boardId = JSON.parse(board.payload)[0].id
    await app.inject({
      method: 'POST', url: `/api/boards/${boardId}/columns`,
      payload: { name: 'Done', color: '#10b981', position: 1 },
    })
    const full = await app.inject({ method: 'GET', url: `/api/boards/${boardId}` })
    const cols = JSON.parse(full.payload).columns
    const reversed = cols.map((c: any) => c.id).reverse()
    const res = await app.inject({
      method: 'PUT', url: `/api/boards/${boardId}/columns/reorder`,
      payload: { columnIds: reversed },
    })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /api/columns/:id deletes a column', async () => {
    const board = await app.inject({ method: 'GET', url: '/api/boards' })
    const boardId = JSON.parse(board.payload)[0].id
    const full = await app.inject({ method: 'GET', url: `/api/boards/${boardId}` })
    const colId = JSON.parse(full.payload).columns[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/columns/${colId}` })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE /api/boards/:id deletes a board', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/boards' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/boards/${id}` })
    expect(res.statusCode).toBe(204)
  })
})
