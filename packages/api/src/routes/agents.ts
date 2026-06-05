import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { getAgentCostSummary } from '../services/cost-tracker.js'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  app.get('/api/agents', async (_req, reply) => {
    const agents = db.prepare('SELECT * FROM agents ORDER BY created_at').all()
    return reply.send(toCamelCaseArray(agents as any[]))
  })

  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const raw = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as any
    if (!raw) return reply.status(404).send({ error: 'Agent not found' })

    const agent = toCamelCase<Record<string, unknown>>(raw)
    const skills = toCamelCaseArray(db.prepare(`
      SELECT s.* FROM skills s
      JOIN agent_skills ags ON ags.skill_id = s.id
      WHERE ags.agent_id = ?
    `).all(req.params.id) as any[])

    const children = toCamelCaseArray(db.prepare('SELECT * FROM agents WHERE parent_agent_id = ?').all(req.params.id) as any[])

    return reply.send({ ...agent, skills, children })
  })

  app.post('/api/agents', async (req, reply) => {
    const { name, role, instructions, providerId, model, costLimitUsd, parentAgentId } = req.body as any
    const id = randomUUID()
    db.prepare(`
      INSERT INTO agents (id, name, role, instructions, provider_id, model, cost_limit_usd, parent_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, role ?? null, instructions ?? null, providerId ?? null,
      model ?? null, costLimitUsd ?? 0, parentAgentId ?? null)
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(agent as any))
  })

  app.put<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const { name, role, instructions, providerId, model, costLimitUsd, parentAgentId } = req.body as any
    const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Agent not found' })

    db.prepare(`
      UPDATE agents SET name = ?, role = ?, instructions = ?, provider_id = ?, model = ?,
        cost_limit_usd = ?, parent_agent_id = ?
      WHERE id = ?
    `).run(
      name ?? existing.name, role ?? existing.role, instructions ?? existing.instructions,
      providerId ?? existing.provider_id, model ?? existing.model,
      costLimitUsd ?? existing.cost_limit_usd, parentAgentId ?? existing.parent_agent_id,
      req.params.id
    )
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(agent as any))
  })

  app.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/api/agents/:id/skills', async (req, reply) => {
    const { skillId } = req.body as { skillId: string }
    try {
      db.prepare('INSERT INTO agent_skills (agent_id, skill_id) VALUES (?, ?)').run(req.params.id, skillId)
      return reply.status(201).send({ agentId: req.params.id, skillId })
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) return reply.status(409).send({ error: 'Skill already assigned' })
      throw err
    }
  })

  app.delete<{ Params: { id: string; skillId: string } }>('/api/agents/:id/skills/:skillId', async (req, reply) => {
    db.prepare('DELETE FROM agent_skills WHERE agent_id = ? AND skill_id = ?').run(req.params.id, req.params.skillId)
    return reply.status(204).send()
  })

  app.get<{ Params: { id: string } }>('/api/agents/:id/cost', async (req, reply) => {
    const summary = getAgentCostSummary(db, req.params.id)
    return reply.send(summary)
  })
}
