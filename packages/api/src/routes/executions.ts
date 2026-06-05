import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function executionRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  // List executions
  app.get('/api/executions', async (_req, reply) => {
    const execs = db.prepare('SELECT * FROM executions ORDER BY created_at DESC').all()
    return reply.send(toCamelCaseArray(execs as any[]))
  })

  // Get execution with tasks, gaps, logs
  app.get<{ Params: { id: string } }>('/api/executions/:id', async (req, reply) => {
    const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any
    if (!exec) return reply.status(404).send({ error: 'Execution not found' })
    const tasks = db.prepare('SELECT * FROM execution_tasks WHERE execution_id = ? ORDER BY created_at').all(req.params.id)
    const gaps = db.prepare('SELECT * FROM execution_gaps WHERE execution_id = ?').all(req.params.id)

    // Get logs for each task (last 50 per task)
    const tasksWithLogs = (tasks as any[]).map(t => {
      const logs = db.prepare('SELECT * FROM execution_logs WHERE execution_task_id = ? ORDER BY created_at DESC LIMIT 50').all(t.id)
      return { ...toCamelCase(t), logs: toCamelCaseArray(logs as any[]) }
    })

    return reply.send({
      ...toCamelCase(exec),
      tasks: tasksWithLogs,
      gaps: toCamelCaseArray(gaps as any[]),
    })
  })

  // Create execution
  app.post('/api/executions', async (req, reply) => {
    const { cardId, specId } = req.body as any
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO executions (id, card_id, spec_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, cardId ?? null, specId ?? null, now, now)
    const exec = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as any)
    broadcast('execution:updated', exec)
    return reply.status(201).send(exec)
  })

  // Start execution (triggers engine)
  app.post<{ Params: { id: string } }>('/api/executions/:id/execute', async (req, reply) => {
    try {
      const { ExecutionEngine } = await import('../services/execution-engine.js')
      const registry = (app as any).providerRegistry
      const engine = new ExecutionEngine(db, registry)
      await engine.startExecution(req.params.id)
      const exec = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any)
      return reply.send(exec)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Cancel execution
  app.post<{ Params: { id: string } }>('/api/executions/:id/cancel', async (req, reply) => {
    db.prepare("UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run('failed', req.params.id)
    const exec = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any)
    broadcast('execution:updated', exec)
    return reply.send(exec)
  })

  // Resolve gap
  app.post<{ Params: { id: string; gapId: string } }>('/api/executions/:id/gaps/:gapId/resolve', async (req, reply) => {
    const { response } = req.body as { response: string }
    db.prepare('UPDATE execution_gaps SET response = ?, status = ? WHERE id = ?')
      .run(response, 'resolved', req.params.gapId)

    const exec = toCamelCase(db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id) as any)
    broadcast('execution:updated', exec)
    return reply.send(exec)
  })
}
