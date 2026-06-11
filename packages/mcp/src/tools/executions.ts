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

export function registerExecutionTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_executions_list',
    'List execution runs, optionally filtered by card',
    { cardId: z.string().optional().describe('Filter by card ID') },
    async ({ cardId }) => {
      const query = cardId
        ? 'SELECT * FROM executions WHERE card_id = ? ORDER BY started_at DESC'
        : 'SELECT * FROM executions ORDER BY started_at DESC LIMIT 50'
      const execs = (cardId ? db.prepare(query).all(cardId) : db.prepare(query).all()) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(execs.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_get',
    'Get execution details',
    { executionId: z.string().describe('Execution ID') },
    async ({ executionId }) => {
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as Record<string, unknown> | undefined
      if (!exec) return { content: [{ type: 'text' as const, text: 'Execution not found' }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(exec), null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_create',
    'Create a new execution run for a card',
    {
      cardId: z.string().describe('Card ID'),
      branch: z.string().optional().describe('Git branch name'),
    },
    async ({ cardId, branch }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      db.prepare(`
        INSERT INTO executions (id, card_id, branch, started_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(id, cardId, branch ?? null)
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(exec), null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_complete',
    'Complete an execution with outcome',
    {
      executionId: z.string().describe('Execution ID'),
      outcome: z.enum(['success', 'failed']).describe('Execution outcome'),
      prUrl: z.string().optional().describe('Pull request URL'),
    },
    async ({ executionId, outcome, prUrl }) => {
      db.prepare(
        "UPDATE executions SET finished_at = datetime('now'), outcome = ?, pr_url = ? WHERE id = ?"
      ).run(outcome, prUrl ?? null, executionId)
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(exec), null, 2) }] }
    }
  )
}
