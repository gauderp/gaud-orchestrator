import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function executeColumnAction(
  db: Database.Database,
  cardId: string,
  column: { id: string; name: string; agent_action_prompt: string; auto_move: number; board_id: string },
): Promise<void> {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any
  if (!card) return

  const commentId = randomUUID()
  db.prepare('INSERT INTO card_comments (id, card_id, author_type, content) VALUES (?, ?, ?, ?)')
    .run(commentId, cardId, 'system', `Column action triggered: "${column.agent_action_prompt}"`)

  broadcast('card:comment', { cardId, comment: { id: commentId, authorType: 'system', content: `Column action triggered` } })

  // If column action suggests execution, create an execution from approved spec
  if (column.agent_action_prompt.toLowerCase().includes('execute') ||
      column.agent_action_prompt.toLowerCase().includes('decompose')) {
    const spec = db.prepare(
      'SELECT * FROM specs WHERE source_card_id = ? AND status = ? ORDER BY version DESC LIMIT 1'
    ).get(cardId, 'approved') as any

    if (spec) {
      const execId = randomUUID()
      db.prepare('INSERT INTO executions (id, card_id, spec_id) VALUES (?, ?, ?)').run(execId, cardId, spec.id)
      broadcast('execution:updated', { id: execId, cardId, specId: spec.id, status: 'planning' })
    }
  }

  if (column.auto_move) {
    const colPos = db.prepare('SELECT position FROM columns WHERE id = ?').get(column.id) as any
    const nextCol = db.prepare(
      'SELECT * FROM columns WHERE board_id = ? AND position > ? ORDER BY position LIMIT 1'
    ).get(column.board_id, colPos?.position ?? 0) as any

    if (nextCol) {
      const now = new Date().toISOString()
      db.prepare('UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?').run(nextCol.id, now, cardId)
      const movedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId)
      broadcast('card:moved', toCamelCase(movedCard as any))
    }
  }
}
