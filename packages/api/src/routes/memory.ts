import type { FastifyInstance } from 'fastify'
import { getDb } from '../db/connection.js'
import { AgentMemory } from '../services/memory.js'
import { createEmbeddingRegistry } from '../services/embeddings.js'
import { broadcast } from '../ws/broadcast.js'

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()
  const embeddingRegistry = createEmbeddingRegistry()
  const memory = new AgentMemory(db, embeddingRegistry)

  // List memories for an agent
  app.get('/api/agents/:id/memories', async (req) => {
    const { id } = req.params as { id: string }
    const { type, limit } = req.query as { type?: string; limit?: string }
    return memory.listForAgent(id, {
      type: type as any,
      limit: limit ? parseInt(limit) : undefined,
    })
  })

  // Semantic search
  app.get('/api/agents/:id/memories/search', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { q, limit } = req.query as { q?: string; limit?: string }
    if (!q) return reply.status(400).send({ error: 'Query parameter "q" is required' })
    return memory.search(q, {
      agentId: id,
      limit: limit ? parseInt(limit) : 5,
    })
  })

  // Store memory manually
  app.post('/api/agents/:id/memories', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { type, content, metadata, tags } = req.body as {
      type: string; content: string; metadata?: Record<string, unknown>; tags?: string[]
    }
    if (!type || !content) return reply.status(400).send({ error: 'type and content are required' })
    const entry = await memory.store({
      agentId: id,
      type: type as any,
      content,
      metadata: metadata ?? {},
      tags: tags ?? [],
    })
    broadcast('memory:stored', { agentId: id, memory: entry })
    return reply.status(201).send(entry)
  })

  // Delete memory
  app.delete('/api/memories/:id', async (_req, reply) => {
    const { id } = (_req as any).params as { id: string }
    memory.delete(id)
    return reply.status(204).send()
  })

  // Stats
  app.get('/api/memory/stats', async () => {
    return memory.getStats()
  })

  // Trigger consolidation
  app.post('/api/memory/consolidate', async (_req, reply) => {
    const agents = db.prepare('SELECT id FROM agents').all() as any[]
    const results: Record<string, { merged: number; decayed: number }> = {}
    for (const agent of agents) {
      results[agent.id] = await memory.consolidate(agent.id)
    }
    broadcast('memory:consolidated', results)
    return reply.send({ status: 'ok', results })
  })
}
