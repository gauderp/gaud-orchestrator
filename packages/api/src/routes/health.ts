import type { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection.js'
import { clientCount } from '../ws/broadcast.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_req, reply) => {
    const db = getDb()
    const tableCount = db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations'"
    ).get() as { count: number }

    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: {
        tables: tableCount.count,
      },
      ws: {
        clients: clientCount(),
      },
    })
  })
}
