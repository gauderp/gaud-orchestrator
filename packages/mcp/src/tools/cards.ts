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

export function registerCardTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_cards_list',
    'List all cards on a board',
    { boardId: z.string().describe('Board ID') },
    async ({ boardId }) => {
      const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(boardId) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(cards.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_cards_get',
    'Get card details including repos, comments, and dependencies',
    { cardId: z.string().describe('Card ID') },
    async ({ cardId }) => {
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as Record<string, unknown> | undefined
      if (!card) return { content: [{ type: 'text' as const, text: 'Card not found' }] }
      const repos = db.prepare('SELECT * FROM card_repos WHERE card_id = ?').all(cardId) as Record<string, unknown>[]
      const comments = db.prepare('SELECT * FROM card_comments WHERE card_id = ? ORDER BY created_at DESC LIMIT 20').all(cardId) as Record<string, unknown>[]
      const deps = db.prepare('SELECT * FROM card_dependencies WHERE card_id = ?').all(cardId) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(card),
        repos: repos.map(toCamelCase),
        comments: comments.map(toCamelCase),
        dependencies: deps.map(toCamelCase),
      }, null, 2) }] }
    }
  )

  server.tool(
    'gaud_cards_create',
    'Create a new card on a board',
    {
      boardId: z.string().describe('Board ID'),
      columnId: z.string().describe('Column ID'),
      title: z.string().describe('Card title'),
      type: z.enum(['project', 'epic', 'task', 'bug']).describe('Card type'),
      description: z.string().optional().describe('Card description'),
      assignedAgentId: z.string().optional().describe('Agent ID to assign'),
    },
    async ({ boardId, columnId, title, type, description, assignedAgentId }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      const maxPos = db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(columnId) as { mp: number | null } | undefined
      db.prepare(`
        INSERT INTO cards (id, board_id, column_id, type, title, description, assigned_agent_id, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, boardId, columnId, type, title, description ?? null, assignedAgentId ?? null, (maxPos?.mp ?? -1) + 1, now, now)
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(card), null, 2) }] }
    }
  )

  server.tool(
    'gaud_cards_move',
    'Move a card to a different column',
    {
      cardId: z.string().describe('Card ID'),
      columnId: z.string().describe('Target column ID'),
    },
    async ({ cardId, columnId }) => {
      const now = new Date().toISOString()
      db.prepare('UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?').run(columnId, now, cardId)
      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(card), null, 2) }] }
    }
  )
}
