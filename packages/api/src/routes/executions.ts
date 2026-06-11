import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { requireRole } from '../middleware/auth.js'

export async function executionRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')

  // List executions (run log) — optionally filter by card
  app.get<{ Querystring: { cardId?: string } }>('/api/executions', async (req, reply) => {
    const { cardId } = req.query as any
    if (cardId) {
      const runs = db.prepare('SELECT * FROM executions WHERE card_id = ? ORDER BY started_at DESC').all(cardId)
      return reply.send(toCamelCaseArray(runs as any[]))
    }
    const runs = db.prepare('SELECT * FROM executions ORDER BY started_at DESC LIMIT 50').all()
    return reply.send(toCamelCaseArray(runs as any[]))
  })

  // Get single execution
  app.get<{ Params: { id: string } }>('/api/executions/:id', async (req, reply) => {
    const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id)
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })
    return reply.send(toCamelCase(execution as any))
  })

  // Create a new execution run for a card
  app.post('/api/executions', { preHandler: [editorPlus] }, async (req, reply) => {
    const { cardId, branch } = req.body as any
    if (!cardId) return reply.status(400).send({ error: 'cardId is required' })
    const id = randomUUID()
    db.prepare(
      "INSERT INTO executions (id, card_id, branch, started_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(id, cardId, branch ?? null)
    const execution = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as any)
    broadcast('execution:updated', execution)
    return reply.status(201).send(execution)
  })

  // Complete an execution
  app.post<{ Params: { id: string } }>('/api/executions/:id/complete', { preHandler: [editorPlus] }, async (req, reply) => {
    const { outcome, prUrl } = req.body as any
    const execution = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    db.prepare(
      "UPDATE executions SET finished_at = datetime('now'), outcome = ?, pr_url = ? WHERE id = ?"
    ).run(outcome, prUrl ?? null, req.params.id)

    const updated = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any)
    broadcast('execution:updated', updated)
    return reply.send(updated)
  })
}
