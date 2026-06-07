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
    'List executions with optional status filter',
    { status: z.enum(['planning', 'approving', 'executing', 'done', 'failed']).optional().describe('Filter by status') },
    async ({ status }) => {
      const query = status
        ? 'SELECT * FROM executions WHERE status = ? ORDER BY updated_at DESC'
        : 'SELECT * FROM executions ORDER BY updated_at DESC'
      const execs = (status ? db.prepare(query).all(status) : db.prepare(query).all()) as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(execs.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_get',
    'Get execution details with tasks, gaps, and logs',
    { executionId: z.string().describe('Execution ID') },
    async ({ executionId }) => {
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as Record<string, unknown> | undefined
      if (!exec) return { content: [{ type: 'text' as const, text: 'Execution not found' }] }
      const tasks = db.prepare('SELECT * FROM execution_tasks WHERE execution_id = ? ORDER BY created_at').all(executionId) as Record<string, unknown>[]
      const gaps = db.prepare('SELECT * FROM execution_gaps WHERE execution_id = ?').all(executionId) as Record<string, unknown>[]
      const taskIds = tasks.map(t => t['id'] as string)
      let logs: Record<string, unknown>[] = []
      if (taskIds.length > 0) {
        const placeholders = taskIds.map(() => '?').join(',')
        logs = db.prepare(`SELECT * FROM execution_logs WHERE execution_task_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 50`).all(...taskIds) as Record<string, unknown>[]
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(exec),
        tasks: tasks.map(toCamelCase),
        gaps: gaps.map(toCamelCase),
        recentLogs: logs.map(toCamelCase),
      }, null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_create',
    'Create a new execution from a card and spec',
    {
      cardId: z.string().describe('Card ID'),
      specId: z.string().describe('Spec ID'),
    },
    async ({ cardId, specId }) => {
      const { randomUUID } = await import('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO executions (id, card_id, spec_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'planning', ?, ?)
      `).run(id, cardId, specId, now, now)
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(exec), null, 2) }] }
    }
  )

  server.tool(
    'gaud_executions_cancel',
    'Cancel an execution',
    { executionId: z.string().describe('Execution ID') },
    async ({ executionId }) => {
      const now = new Date().toISOString()
      db.prepare("UPDATE executions SET status = 'failed', updated_at = ? WHERE id = ?").run(now, executionId)
      const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as Record<string, unknown>
      return { content: [{ type: 'text' as const, text: JSON.stringify(toCamelCase(exec), null, 2) }] }
    }
  )
}
