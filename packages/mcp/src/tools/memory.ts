import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { z } from 'zod'

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value
  }
  return result
}

export function registerMemoryTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_memory_search',
    'Search agent memories by keyword',
    {
      query: z.string().describe('Search query'),
      agentId: z.string().optional().describe('Filter by agent ID'),
      limit: z.number().optional().describe('Max results (default 10)'),
    },
    async ({ query, agentId, limit }) => {
      const maxResults = limit ?? 10
      // Simple keyword search (semantic search requires embeddings at runtime)
      const pattern = `%${query}%`
      const sql = agentId
        ? 'SELECT * FROM agent_memories WHERE agent_id = ? AND content LIKE ? ORDER BY relevance_score DESC, updated_at DESC LIMIT ?'
        : 'SELECT * FROM agent_memories WHERE content LIKE ? ORDER BY relevance_score DESC, updated_at DESC LIMIT ?'
      const memories = (agentId
        ? db.prepare(sql).all(agentId, pattern, maxResults)
        : db.prepare(sql).all(pattern, maxResults)
      ) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(memories.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_memory_store',
    'Store a new agent memory',
    {
      agentId: z.string().describe('Agent ID'),
      type: z.enum(['conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference']).describe('Memory type'),
      content: z.string().describe('Memory content'),
      tags: z.string().optional().describe('Comma-separated tags'),
    },
    async ({ agentId, type, content, tags }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO agent_memories (id, agent_id, type, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, agentId, type, content, tags ?? null, now, now)
      const memory = db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(memory), null, 2) }] }
    }
  )

  server.tool(
    'gaud_memory_stats',
    'Get memory statistics per agent',
    {},
    async () => {
      const stats = db.prepare(`
        SELECT agent_id, a.name as agent_name, type, COUNT(*) as count
        FROM agent_memories m
        JOIN agents a ON a.id = m.agent_id
        GROUP BY agent_id, type
        ORDER BY a.name, type
      `).all() as Record<string, unknown>[]
      const total = (db.prepare('SELECT COUNT(*) as c FROM agent_memories').get() as { c: number }).c
      return { content: [{ type: 'text' as const, text: JSON.stringify({ total, byAgentAndType: stats.map(toCamelCase) }, null, 2) }] }
    }
  )
}
