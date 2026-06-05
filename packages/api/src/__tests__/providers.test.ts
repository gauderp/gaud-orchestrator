import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { providerRoutes } from '../routes/providers.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Providers API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    app.decorate('db', db)
    await app.register(providerRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
  })

  it('POST /api/providers creates a provider', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/providers',
      payload: { name: 'Claude CLI', type: 'claude-cli', configJson: { path: 'claude' } },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).type).toBe('claude-cli')
  })

  it('GET /api/providers lists providers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/providers' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).length).toBe(1)
  })

  it('PUT /api/providers/:id updates config', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/providers' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'PUT',
      url: `/api/providers/${id}`,
      payload: { name: 'Claude CLI v2', type: 'claude-cli', configJson: { path: 'claude', model: 'sonnet' } },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).name).toBe('Claude CLI v2')
  })

  it('DELETE /api/providers/:id deletes', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/providers' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/providers/${id}` })
    expect(res.statusCode).toBe(204)
  })
})
