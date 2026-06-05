import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { skillRoutes } from '../routes/skills.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Skills API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    const sql = readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8')
    db.exec(sql)
    app.decorate('db', db)
    await app.register(skillRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
  })

  it('POST /api/skills creates a skill', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills',
      payload: { name: 'TDD', description: 'Test-driven development', content: '# TDD\n\nWrite tests first.' },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.name).toBe('TDD')
    expect(body.id).toBeTruthy()
  })

  it('GET /api/skills lists skills', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/skills/:id returns a skill', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/skills' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'GET', url: `/api/skills/${id}` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).name).toBe('TDD')
  })

  it('PUT /api/skills/:id updates a skill', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/skills' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'PUT',
      url: `/api/skills/${id}`,
      payload: { name: 'TDD Updated', description: 'Updated', content: '# TDD v2' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).name).toBe('TDD Updated')
  })

  it('DELETE /api/skills/:id deletes a skill', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/skills' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/skills/${id}` })
    expect(res.statusCode).toBe(204)
  })
})
