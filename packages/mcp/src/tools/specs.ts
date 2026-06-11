import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { BOARD_IDS, SPEC_COLUMNS } from '@gaud/shared'

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value
  }
  return result
}

export function registerSpecTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_specs_list',
    'List specs (joined with card to show board position)',
    {},
    async () => {
      const specs = db.prepare(`
        SELECT s.*, c.column_id, c.board_id
        FROM specs s
        LEFT JOIN cards c ON c.id = s.card_id
        ORDER BY s.updated_at DESC
      `).all() as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(specs.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_specs_get',
    'Get spec with reviews',
    { specId: z.string().describe('Spec ID') },
    async ({ specId }) => {
      const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(specId) as Record<string, unknown> | undefined
      if (!spec) return { content: [{ type: 'text' as const, text: 'Spec not found' }] }
      const reviews = db.prepare('SELECT * FROM spec_reviews WHERE spec_id = ? ORDER BY created_at DESC').all(specId) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(spec),
        reviews: reviews.map(toCamelCase),
      }, null, 2) }] }
    }
  )

  server.tool(
    'gaud_specs_create',
    'Create a new spec (also creates a card on the Spec board)',
    {
      title: z.string().describe('Spec title'),
      content: z.string().describe('Spec content (markdown)'),
      cardId: z.string().optional().describe('Existing card ID to link (if omitted, a new card is created)'),
    },
    async ({ title, content, cardId }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()

      let specCardId = cardId
      if (!specCardId) {
        specCardId = randomUUID()
        db.prepare(
          'INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        ).run(specCardId, BOARD_IDS.SPEC, SPEC_COLUMNS.IDEAS, 'task', title, now, now)
      }

      db.prepare(`
        INSERT INTO specs (id, title, content, card_id, created_by_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', ?, ?)
      `).run(id, title, content, specCardId, now, now)
      const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(spec), null, 2) }] }
    }
  )

  server.tool(
    'gaud_specs_review',
    'Submit a review for a spec (approve, reject, or comment) — moves the card column accordingly',
    {
      specId: z.string().describe('Spec ID'),
      verdict: z.enum(['approve', 'reject', 'comment']).describe('Review verdict'),
      comment: z.string().optional().describe('Review comment'),
    },
    async ({ specId, verdict, comment }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO spec_reviews (id, spec_id, reviewer_type, verdict, comment, created_at)
        VALUES (?, ?, 'user', ?, ?, ?)
      `).run(id, specId, verdict, comment ?? null, now)

      const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(specId) as Record<string, unknown> | undefined
      if (spec && spec['card_id']) {
        if (verdict === 'approve') {
          db.prepare("UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?")
            .run(SPEC_COLUMNS.APPROVED, now, spec['card_id'])
        } else if (verdict === 'reject') {
          db.prepare("UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?")
            .run(SPEC_COLUMNS.DRAFTING, now, spec['card_id'])
        }
      }

      db.prepare("UPDATE specs SET updated_at = ? WHERE id = ?").run(now, specId)

      const review = db.prepare('SELECT * FROM spec_reviews WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(review), null, 2) }] }
    }
  )
}
