import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { boardRoutes } from '../routes/boards.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Boards API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))

    // Seed with fixed boards matching migration 011
    db.prepare("INSERT INTO boards (id, name) VALUES ('triage-board', 'Triage')").run()
    db.prepare("INSERT INTO boards (id, name) VALUES ('spec-board', 'Spec')").run()
    db.prepare("INSERT INTO boards (id, name) VALUES ('dev-board', 'Dev')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, color, position) VALUES ('triage-col-new', 'triage-board', 'New', '#3B82F6', 0)").run()
    db.prepare("INSERT INTO columns (id, board_id, name, color, position) VALUES ('triage-col-interviewing', 'triage-board', 'Interviewing', '#F59E0B', 1)").run()

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
    expect(body.columns).toBeDefined()
    expect(Array.isArray(body.columns)).toBe(true)
    expect(body.columns.length).toBe(2)
    expect(body.columns[0].name).toBe('New')
  })

  it('GET /api/boards/:id returns 404 for unknown board', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})
