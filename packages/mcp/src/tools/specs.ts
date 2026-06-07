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

export function registerSpecTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_specs_list',
    'List specs with optional status filter',
    { status: z.enum(['draft', 'review', 'approved', 'rejected']).optional().describe('Filter by status') },
    async ({ status }) => {
      const query = status
        ? 'SELECT * FROM specs WHERE status = ? ORDER BY updated_at DESC'
        : 'SELECT * FROM specs ORDER BY updated_at DESC'
      const specs = (status ? db.prepare(query).all(status) : db.prepare(query).all()) as Record<string, unknown>[]
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
    'Create a new spec',
    {
      title: z.string().describe('Spec title'),
      content: z.string().describe('Spec content (markdown)'),
      sourceCardId: z.string().optional().describe('Card ID this spec is for'),
    },
    async ({ title, content, sourceCardId }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO specs (id, title, content, status, source_card_id, created_by_type, created_at, updated_at)
        VALUES (?, ?, ?, 'draft', ?, 'user', ?, ?)
      `).run(id, title, content, sourceCardId ?? null, now, now)
      const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(spec), null, 2) }] }
    }
  )

  server.tool(
    'gaud_specs_review',
    'Submit a review for a spec (approve, reject, or comment)',
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

      if (verdict === 'approve') {
        db.prepare("UPDATE specs SET status = 'approved', updated_at = ? WHERE id = ?").run(now, specId)
      } else if (verdict === 'reject') {
        db.prepare("UPDATE specs SET status = 'rejected', updated_at = ? WHERE id = ?").run(now, specId)
      }

      const review = db.prepare('SELECT * FROM spec_reviews WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(review), null, 2) }] }
    }
  )
}
