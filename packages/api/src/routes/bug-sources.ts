import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { getDb } from '../db/connection.js'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { requireRole } from '../middleware/auth.js'

export async function bugSourceRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')

  // List all bug sources
  app.get('/api/bug-sources', async (_req, reply) => {
    const sources = db.prepare('SELECT * FROM bug_sources ORDER BY created_at DESC').all()
    return reply.send(toCamelCaseArray(sources as any[]))
  })

  // Create a new bug source
  app.post('/api/bug-sources', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name, type, configJson } = req.body as any
    if (!name?.trim() || !type?.trim()) {
      return reply.status(400).send({ error: 'name and type are required' })
    }
    const id = crypto.randomUUID()
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    db.prepare(
      'INSERT INTO bug_sources (id, name, type, config_json, webhook_secret) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name.trim(), type.trim(), configJson || '{}', webhookSecret)

    const source = toCamelCase(db.prepare('SELECT * FROM bug_sources WHERE id = ?').get(id) as any)
    return reply.status(201).send(source)
  })

  // Toggle enabled/disabled
  app.put<{ Params: { id: string } }>('/api/bug-sources/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    const { enabled } = req.body as any
    const result = db.prepare('UPDATE bug_sources SET enabled = ? WHERE id = ?')
      .run(enabled ? 1 : 0, req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Source not found' })
    const source = toCamelCase(db.prepare('SELECT * FROM bug_sources WHERE id = ?').get(req.params.id) as any)
    return reply.send(source)
  })

  // Delete
  app.delete<{ Params: { id: string } }>('/api/bug-sources/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    const result = db.prepare('DELETE FROM bug_sources WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Source not found' })
    return reply.status(204).send()
  })
}
