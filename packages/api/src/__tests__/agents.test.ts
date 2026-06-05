import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { agentRoutes } from '../routes/agents.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Agents API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    app.decorate('db', db)
    await app.register(agentRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('POST /api/agents creates an agent', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/agents',
      payload: { name: 'Fiscal Agent', role: 'Tax specialist', instructions: '# Fiscal\n\nKnows taxes.' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).name).toBe('Fiscal Agent')
  })

  it('GET /api/agents returns list', async () => {
    const parent = await app.inject({ method: 'GET', url: '/api/agents' })
    const parentId = JSON.parse(parent.payload)[0].id
    await app.inject({
      method: 'POST', url: '/api/agents',
      payload: { name: 'NFS-e Agent', role: 'NFS-e specialist', parentAgentId: parentId },
    })
    const res = await app.inject({ method: 'GET', url: '/api/agents' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).length).toBe(2)
  })

  it('GET /api/agents/:id returns detail with skills', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'GET', url: `/api/agents/${id}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.skills).toBeDefined()
    expect(Array.isArray(body.skills)).toBe(true)
  })

  it('POST /api/agents/:id/skills assigns a skill', async () => {
    db.prepare("INSERT INTO skills (id, name, content) VALUES ('s1', 'TDD', '# TDD')").run()
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const agentId = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'POST', url: `/api/agents/${agentId}/skills`,
      payload: { skillId: 's1' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('GET /api/agents/:id/cost returns cost summary', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'GET', url: `/api/agents/${id}/cost` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).totalCostUsd).toBeDefined()
  })

  it('DELETE /api/agents/:id/skills/:skillId removes skill', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const agentId = JSON.parse(list.payload)[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/agents/${agentId}/skills/s1` })
    expect(res.statusCode).toBe(204)
  })

  it('PUT /api/agents/:id updates agent', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const id = JSON.parse(list.payload)[0].id
    const res = await app.inject({
      method: 'PUT', url: `/api/agents/${id}`,
      payload: { name: 'Fiscal Agent v2', costLimitUsd: 50 },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).name).toBe('Fiscal Agent v2')
  })

  it('DELETE /api/agents/:id deletes agent', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents' })
    const lastId = JSON.parse(list.payload).pop().id
    const res = await app.inject({ method: 'DELETE', url: `/api/agents/${lastId}` })
    expect(res.statusCode).toBe(204)
  })
})
