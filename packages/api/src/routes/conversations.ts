import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  // List conversations for a card
  app.get<{ Params: { cardId: string } }>('/api/cards/:cardId/conversations', async (req, reply) => {
    const convs = db.prepare('SELECT * FROM conversations WHERE card_id = ? ORDER BY created_at DESC').all(req.params.cardId)
    return reply.send(toCamelCaseArray(convs as any[]))
  })

  // Create conversation with participants
  app.post('/api/conversations', async (req, reply) => {
    const { cardId, type, agentIds } = req.body as { cardId?: string; type: string; agentIds: string[] }
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, cardId ?? null, type, now, now)

    // Add participants
    const insertParticipant = db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
    for (const agentId of agentIds) {
      insertParticipant.run(id, agentId)
    }

    // Return with participants
    const conv = toCamelCase(db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any)
    const participants = toCamelCaseArray(
      db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ?').all(id) as any[]
    )

    const result = { ...conv, participants, messages: [] }
    broadcast('conversation:status', { conversationId: id, status: 'active' })
    return reply.status(201).send(result)
  })

  // Get conversation with messages and participants
  app.get<{ Params: { id: string } }>('/api/conversations/:id', async (req, reply) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any
    if (!conv) return reply.status(404).send({ error: 'Conversation not found' })
    const participants = db.prepare(`
      SELECT cp.*, a.name as agent_name FROM conversation_participants cp
      JOIN agents a ON a.id = cp.agent_id
      WHERE cp.conversation_id = ?
    `).all(req.params.id)
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(req.params.id)
    return reply.send({
      ...toCamelCase(conv),
      participants: toCamelCaseArray(participants as any[]),
      messages: toCamelCaseArray(messages as any[]),
    })
  })

  // List messages (paginated)
  app.get<{ Params: { id: string } }>('/api/conversations/:id/messages', async (req, reply) => {
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(req.params.id)
    return reply.send(toCamelCaseArray(messages as any[]))
  })

  // Send user message
  app.post<{ Params: { id: string } }>('/api/conversations/:id/messages', async (req, reply) => {
    const { content } = req.body as { content: string }
    const msgId = randomUUID()
    db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(msgId, req.params.id, 'user', content, 'content')
    const msg = toCamelCase(db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as any)

    // If conversation was paused_for_user, resume it
    const conv = db.prepare('SELECT status FROM conversations WHERE id = ?').get(req.params.id) as any
    if (conv?.status === 'paused_for_user') {
      db.prepare('UPDATE conversations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('active', req.params.id)
      broadcast('conversation:status', { conversationId: req.params.id, status: 'active' })
    }

    broadcast('conversation:message', { conversationId: req.params.id, message: msg })
    return reply.status(201).send(msg)
  })

  // Add agent to conversation
  app.post<{ Params: { id: string } }>('/api/conversations/:id/add-agent', async (req, reply) => {
    const { agentId } = req.body as { agentId: string }
    db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)').run(req.params.id, agentId)
    return reply.status(201).send({ conversationId: req.params.id, agentId })
  })

  // Trigger next agent turn
  app.post<{ Params: { id: string } }>('/api/conversations/:id/next-turn', async (req, reply) => {
    const { runConversationTurn } = await import('../services/conversation-runner.js')
    const { createProviderRegistry, createClaudeCliProvider } = await import('@gaud/providers')

    // TODO: load providers from DB and register them properly
    const registry = createProviderRegistry()
    registry.register(createClaudeCliProvider())

    try {
      const result = await runConversationTurn(db, req.params.id, registry)
      return reply.send(result)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Pause conversation
  app.post<{ Params: { id: string } }>('/api/conversations/:id/pause', async (req, reply) => {
    db.prepare('UPDATE conversations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('paused_for_user', req.params.id)
    const conv = toCamelCase(db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any)
    broadcast('conversation:status', { conversationId: req.params.id, status: 'paused_for_user' })
    return reply.send(conv)
  })

  // Resume conversation
  app.post<{ Params: { id: string } }>('/api/conversations/:id/resume', async (req, reply) => {
    db.prepare('UPDATE conversations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('active', req.params.id)
    const conv = toCamelCase(db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any)
    broadcast('conversation:status', { conversationId: req.params.id, status: 'active' })
    return reply.send(conv)
  })
}
