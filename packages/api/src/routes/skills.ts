import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  app.get('/api/skills', async (_req, reply) => {
    const skills = db.prepare('SELECT * FROM skills ORDER BY name').all()
    return reply.send(toCamelCaseArray(skills as any[]))
  })

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id)
    if (!skill) return reply.status(404).send({ error: 'Skill not found' })
    return reply.send(toCamelCase(skill as any))
  })

  app.post('/api/skills', async (req, reply) => {
    const { name, description, content } = req.body as { name: string; description?: string; content: string }
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO skills (id, name, description, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, description ?? null, content, now, now)
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(skill as any))
  })

  app.put<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const { name, description, content } = req.body as { name: string; description?: string; content: string }
    const now = new Date().toISOString()
    const result = db.prepare(
      'UPDATE skills SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ?'
    ).run(name, description ?? null, content, now, req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Skill not found' })
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(skill as any))
  })

  app.delete<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Skill not found' })
    return reply.status(204).send()
  })
}
