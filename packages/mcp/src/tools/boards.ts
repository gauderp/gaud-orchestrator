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

export function registerBoardTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_boards_list',
    'List all boards',
    {},
    async () => {
      const boards = db.prepare('SELECT * FROM boards ORDER BY created_at DESC').all() as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(boards.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_boards_get',
    'Get board with columns and cards',
    { boardId: z.string().describe('Board ID') },
    async ({ boardId }) => {
      const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId) as Record<string, unknown> | undefined
      if (!board) return { content: [{ type: 'text' as const, text: 'Board not found' }] }
      const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(boardId) as Record<string, unknown>[]
      const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(boardId) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(board),
        columns: columns.map(toCamelCase),
        cards: cards.map(toCamelCase),
      }, null, 2) }] }
    }
  )
}
