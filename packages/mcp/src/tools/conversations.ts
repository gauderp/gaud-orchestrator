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

export function registerConversationTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_conversations_list',
    'List conversations for a card',
    { cardId: z.string().optional().describe('Card ID to filter (optional — lists all if omitted)') },
    async ({ cardId }) => {
      const query = cardId
        ? 'SELECT * FROM conversations WHERE card_id = ? ORDER BY updated_at DESC'
        : 'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
      const convs = (cardId ? db.prepare(query).all(cardId) : db.prepare(query).all()) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(convs.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_conversations_create',
    'Create a new conversation with agents',
    {
      cardId: z.string().describe('Card ID'),
      type: z.enum(['spec', 'plan', 'code', 'research', 'review']).describe('Conversation type'),
      agentIds: z.array(z.string()).describe('Array of agent IDs to participate'),
    },
    async ({ cardId, type, agentIds }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO conversations (id, card_id, type, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `).run(id, cardId, type, now, now)

      for (const agentId of agentIds) {
        db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id, joined_at) VALUES (?, ?, ?)').run(id, agentId, now)
      }

      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(conv), null, 2) }] }
    }
  )

  server.tool(
    'gaud_conversations_send',
    'Send a user message to a conversation',
    {
      conversationId: z.string().describe('Conversation ID'),
      content: z.string().describe('Message content'),
    },
    async ({ conversationId, content }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_type, content, message_type, created_at)
        VALUES (?, ?, 'user', ?, 'content', ?)
      `).run(id, conversationId, content, now)

      // Reactivate if paused
      db.prepare("UPDATE conversations SET status = 'active', updated_at = ? WHERE id = ? AND status = 'paused_for_user'").run(now, conversationId)

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(msg), null, 2) }] }
    }
  )

  server.tool(
    'gaud_conversations_get',
    'Get conversation with messages',
    {
      conversationId: z.string().describe('Conversation ID'),
      limit: z.number().optional().describe('Max messages to return (default 30)'),
    },
    async ({ conversationId, limit }) => {
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as Record<string, unknown> | undefined
      if (!conv) return { content: [{ type: 'text' as const, text: 'Conversation not found' }] }
      const messages = db.prepare(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(conversationId, limit ?? 30) as Record<string, unknown>[]
      const participants = db.prepare(`
        SELECT a.id, a.name FROM agents a
        JOIN conversation_participants cp ON cp.agent_id = a.id
        WHERE cp.conversation_id = ?
      `).all(conversationId) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(conv),
        participants,
        messages: messages.reverse().map(toCamelCase),
      }, null, 2) }] }
    }
  )
}
