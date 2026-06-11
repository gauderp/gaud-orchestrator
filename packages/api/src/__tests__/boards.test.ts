import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { boardRoutes } from '../routes/boards.js'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/test-db.js'

describe('Boards API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = createTestDb()
    app.decorate('db', db)
    await app.register(boardRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('GET /api/boards lists the fixed boards', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards' })
    const boards = JSON.parse(res.payload)
    expect(boards.length).toBe(3)
    expect(boards.map((b: any) => b.id).sort()).toEqual(['dev-board', 'spec-board', 'triage-board'])
  })

  it('GET /api/boards/:id returns board with columns', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards/triage-board' })
    const body = JSON.parse(res.payload)
    expect(body.name).toBe('Triage')
    expect(Array.isArray(body.columns)).toBe(true)
    expect(body.columns.length).toBe(4)
    expect(body.columns[0].name).toBe('New')
    expect(body.columns[0].boardId).toBe('triage-board')
  })

  it('GET /api/boards/:id returns 404 for unknown board', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})
