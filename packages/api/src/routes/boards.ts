import type { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection.js'

export function boardRoutes(app: FastifyInstance) {
  // List all boards
  app.get('/api/boards', async () => {
    const db = getDb()
    const boards = db.prepare('SELECT * FROM boards ORDER BY name').all()
    return boards
  })

  // Get board with columns
  app.get<{ Params: { id: string } }>('/api/boards/:id', async (req, reply) => {
    const db = getDb()
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id)
    if (!board) return reply.status(404).send({ error: 'Board not found' })

    const columns = db.prepare(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position'
    ).all(req.params.id)

    return { ...board, columns }
  })
}
