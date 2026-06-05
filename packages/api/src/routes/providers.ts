import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  function parseProvider(p: any) {
    return { ...toCamelCase<Record<string, unknown>>(p), configJson: JSON.parse(p.config_json) }
  }

  app.get('/api/providers', async (_req, reply) => {
    const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()
    return reply.send((providers as any[]).map(parseProvider))
  })

  app.get<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    if (!p) return reply.status(404).send({ error: 'Provider not found' })
    return reply.send(parseProvider(p))
  })

  app.post('/api/providers', async (req, reply) => {
    const { name, type, configJson } = req.body as { name: string; type: string; configJson: Record<string, unknown> }
    const id = randomUUID()
    db.prepare(
      'INSERT INTO providers (id, name, type, config_json) VALUES (?, ?, ?, ?)'
    ).run(id, name, type, JSON.stringify(configJson))
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any
    return reply.status(201).send(parseProvider(p))
  })

  app.put<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const { name, type, configJson } = req.body as { name: string; type: string; configJson: Record<string, unknown> }
    const result = db.prepare(
      'UPDATE providers SET name = ?, type = ?, config_json = ? WHERE id = ?'
    ).run(name, type, JSON.stringify(configJson), req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Provider not found' })
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    return reply.send(parseProvider(p))
  })

  app.delete<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    db.prepare('DELETE FROM providers WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/api/providers/:id/test', async (req, reply) => {
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    if (!p) return reply.status(404).send({ error: 'Provider not found' })
    try {
      JSON.parse(p.config_json)
      return reply.send({ success: true, message: 'Config is valid' })
    } catch {
      return reply.send({ success: false, message: 'Invalid config JSON' })
    }
  })
}
