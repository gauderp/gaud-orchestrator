import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function executeColumnAction(
  db: Database.Database,
  cardId: string,
  column: { id: string; name: string; agent_action_prompt: string; auto_move: number; board_id: string },
  providerRegistry: any | null,
): Promise<void> {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any
  if (!card) return

  // Resolve agent: card's assigned agent, or first agent in DB
  const agentId = card.assigned_agent_id
    ?? (db.prepare('SELECT id FROM agents LIMIT 1').get() as any)?.id

  if (!agentId) {
    const commentId = randomUUID()
    db.prepare('INSERT INTO card_comments (id, card_id, author_type, content) VALUES (?, ?, ?, ?)')
      .run(commentId, cardId, 'system', 'Column action skipped: no agents configured')
    broadcast('card:comment', { cardId })
    return
  }

  // Build card context for the prompt
  const repos = (db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(cardId) as any[])
    .map(r => r.repo_path)
  const cardContext = [
    `Card: ${card.title}`,
    card.description ? `Description: ${card.description}` : null,
    repos.length > 0 ? `Repositories: ${repos.join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const seedPrompt = `${column.agent_action_prompt}\n\n## Card Context\n\n${cardContext}`

  // Determine conversation type from column prompt
  const promptLower = column.agent_action_prompt.toLowerCase()
  const convType = promptLower.includes('spec') ? 'spec'
    : promptLower.includes('review') ? 'review'
    : promptLower.includes('test') ? 'code'
    : promptLower.includes('decompose') || promptLower.includes('execute') ? 'plan'
    : 'research'

  // Create conversation
  const convId = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(convId, cardId, convType, now, now)

  // Add agent as participant
  db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
    .run(convId, agentId)

  // Seed with system message containing the column prompt + card context
  db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), convId, 'system', seedPrompt, 'content')

  broadcast('conversation:status', { conversationId: convId, status: 'active' })
  broadcast('card:comment', { cardId, comment: { authorType: 'system', content: `Agent conversation started: ${column.name}` } })

  // If providerRegistry is available, trigger first turn automatically
  if (providerRegistry) {
    try {
      const { runConversationTurn } = await import('./conversation-runner.js')
      const result = await runConversationTurn(db, convId, providerRegistry)

      if (column.auto_move && result.conversationStatus === 'completed') {
        await autoMoveCard(db, cardId, column)
        return // already moved
      }
    } catch (err) {
      console.error('Column action conversation failed:', err)
    }
  }

  // Handle execute/decompose keywords
  if (promptLower.includes('execute') || promptLower.includes('decompose')) {
    const spec = db.prepare(
      'SELECT * FROM specs WHERE source_card_id = ? AND status = ? ORDER BY version DESC LIMIT 1'
    ).get(cardId, 'approved') as any

    if (spec) {
      const execId = randomUUID()
      db.prepare('INSERT INTO executions (id, card_id, spec_id) VALUES (?, ?, ?)').run(execId, cardId, spec.id)
      broadcast('execution:updated', { id: execId, cardId, specId: spec.id, status: 'planning' })
    }
  }

  // Auto-move if enabled and no provider (conversation didn't run)
  if (column.auto_move && !providerRegistry) {
    await autoMoveCard(db, cardId, column)
  }
}

async function autoMoveCard(db: Database.Database, cardId: string, column: { id: string; board_id: string }): Promise<void> {
  const colPos = db.prepare('SELECT position FROM columns WHERE id = ?').get(column.id) as any
  const nextCol = db.prepare(
    'SELECT * FROM columns WHERE board_id = ? AND position > ? ORDER BY position LIMIT 1'
  ).get(column.board_id, colPos?.position ?? 0) as any

  if (nextCol) {
    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?').run(nextCol.id, now, cardId)
    broadcast('card:moved', toCamelCase(db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any))
  }
}
