import type { FastifyInstance } from 'fastify'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

export async function boardRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  // List all boards (the 3 fixed ones)
  app.get('/api/boards', async (_req, reply) => {
    const boards = db.prepare('SELECT * FROM boards ORDER BY name').all()
    return reply.send(toCamelCaseArray(boards as any[]))
  })

  // Get board with columns
  app.get<{ Params: { id: string } }>('/api/boards/:id', async (req, reply) => {
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id) as any
    if (!board) return reply.status(404).send({ error: 'Board not found' })

    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id)
    return reply.send({ ...toCamelCase<Record<string, unknown>>(board), columns: toCamelCaseArray(columns as any[]) })
  })
}
