import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { dashboardRoutes } from '../routes/dashboard.js'
import type Database from 'better-sqlite3'
import { createTestDb } from './helpers/test-db.js'

describe('Dashboard API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    db = createTestDb()

    // Seed data on the fixed boards
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Claude', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a1', 'Coder', 'p1')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a2', 'Fiscal', 'p1')").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('card1', 'dev-board', 'dev-col-todo', 'task', 'Task 1')").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('sc1', 'spec-board', 'spec-col-review', 'task', 'Spec card')").run()
    db.prepare("INSERT INTO specs (id, title, content, card_id, created_by_type) VALUES ('s1', 'Spec', '#', 'sc1', 'user')").run()
    db.prepare("INSERT INTO executions (id, card_id, started_at) VALUES ('e1', 'card1', datetime('now'))").run()
    db.prepare("INSERT INTO agent_cost_log (id, agent_id, tokens_in, tokens_out, cost_usd) VALUES ('cl1', 'a1', 1000, 500, 0.05)").run()

    app.decorate('db', db)
    await app.register(dashboardRoutes)
    await app.ready()
  })

  afterAll(async () => { await app.close(); db.close() })

  it('GET /api/dashboard returns all metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)

    expect(body.agents.total).toBe(2)
    expect(body.agents.configured).toBe(2)
    expect(body.cards.total).toBe(2)
    expect(body.specs.pending).toBe(1)
    expect(body.specs.review).toBe(1)
    expect(body.executions.active).toBe(1)
    expect(body.cost.totalThisMonth).toBeGreaterThanOrEqual(0)
    expect(body.health.status).toBe('ok')
    expect(body.boards.total).toBe(3)
  })

  it('returns zero metrics for empty categories', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard' })
    const body = JSON.parse(res.payload)

    expect(body.conversations.active).toBe(0)
    expect(body.memories.total).toBe(0)
    expect(body.skills.total).toBe(0)
  })
})
