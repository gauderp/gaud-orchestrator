import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { cardRoutes } from '../routes/cards.js'
import { boardRoutes } from '../routes/boards.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Cards API', () => {
  const app = Fastify()
  let db: Database.Database
  let boardId: string
  let colId1: string
  let colId2: string

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    try { db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '002_fix_comment_author_type.sql'), 'utf-8')) } catch { /* optional */ }
    try { db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '003_agent_hierarchy.sql'), 'utf-8')) } catch { /* optional */ }
    try { db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '004_github_repos.sql'), 'utf-8')) } catch { /* optional */ }
    app.decorate('db', db)
    await app.register(boardRoutes)
    await app.register(cardRoutes)
    await app.ready()

    let res = await app.inject({ method: 'POST', url: '/api/boards', payload: { name: 'Test Board' } })
    boardId = JSON.parse(res.payload).id
    res = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/columns`, payload: { name: 'Backlog', position: 0 } })
    colId1 = JSON.parse(res.payload).id
    res = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/columns`, payload: { name: 'Doing', position: 1 } })
    colId2 = JSON.parse(res.payload).id
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/cards creates a card', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/cards',
      payload: { boardId, columnId: colId1, type: 'task', title: 'Fix bug' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).title).toBe('Fix bug')
    expect(JSON.parse(res.payload).columnId).toBe(colId1)
  })

  it('GET /api/boards/:boardId/cards lists cards', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('GET /api/cards/:id returns card with details', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const cardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'GET', url: `/api/cards/${cardId}` })
    const body = JSON.parse(res.payload)
    expect(body.repos).toBeDefined()
    expect(body.comments).toBeDefined()
    expect(body.dependencies).toBeDefined()
  })

  it('PUT /api/cards/:id/move moves card to another column', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const cardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'PUT', url: `/api/cards/${cardId}/move`,
      payload: { columnId: colId2, position: 0 },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).columnId).toBe(colId2)
  })

  it('POST /api/cards/:id/comments adds a comment', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const cardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'POST', url: `/api/cards/${cardId}/comments`,
      payload: { authorType: 'user', content: 'Looks good!' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).content).toBe('Looks good!')
  })

  it('POST /api/cards/:id/repos adds a repo', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const cardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'POST', url: `/api/cards/${cardId}/repos`,
      payload: { repoPath: 'D:/dev/gaud-erp-api', specPath: 'docs/spec.md' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('POST /api/cards/:id/dependencies adds a dependency', async () => {
    const res2 = await app.inject({
      method: 'POST', url: '/api/cards',
      payload: { boardId, columnId: colId1, type: 'task', title: 'Blocked task' },
    })
    const blockedId = JSON.parse(res2.payload).id
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const blockerId = JSON.parse(list.payload)[0].id

    const res = await app.inject({
      method: 'POST', url: `/api/cards/${blockedId}/dependencies`,
      payload: { dependsOnCardId: blockerId },
    })
    expect(res.statusCode).toBe(201)
  })

  it('GET /api/boards/:id/gantt returns gantt data', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/gantt` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.cards).toBeDefined()
    expect(body.dependencies).toBeDefined()
    expect(body.columns).toBeDefined()
  })

  it('DELETE /api/cards/:id deletes a card', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/boards/${boardId}/cards` })
    const cardId = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/cards/${cardId}` })
    expect(res.statusCode).toBe(204)
  })
})
