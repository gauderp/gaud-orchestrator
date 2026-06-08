import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { requireRole } from '../middleware/auth.js'

export async function boardRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')

  app.get('/api/boards', async (_req, reply) => {
    const boards = db.prepare('SELECT * FROM boards ORDER BY created_at DESC').all()
    return reply.send(toCamelCaseArray(boards as any[]))
  })

  app.get<{ Params: { id: string } }>('/api/boards/:id', async (req, reply) => {
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id) as any
    if (!board) return reply.status(404).send({ error: 'Board not found' })
    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id)
    return reply.send({ ...toCamelCase<Record<string, unknown>>(board), columns: toCamelCaseArray(columns as any[]) })
  })

  app.post('/api/boards', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name } = req.body as { name: string }
    const id = randomUUID()
    db.prepare('INSERT INTO boards (id, name) VALUES (?, ?)').run(id, name)
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(board as any))
  })

  app.put<{ Params: { id: string } }>('/api/boards/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name } = req.body as { name: string }
    const result = db.prepare('UPDATE boards SET name = ? WHERE id = ?').run(name, req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Board not found' })
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(board as any))
  })

  app.delete<{ Params: { id: string } }>('/api/boards/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })

  // --- Columns ---

  app.post<{ Params: { boardId: string } }>('/api/boards/:boardId/columns', async (req, reply) => {
    const { name, color, position, agentActionPrompt, autoMove } = req.body as any
    const id = randomUUID()
    db.prepare(`
      INSERT INTO columns (id, board_id, name, color, position, agent_action_prompt, auto_move)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.boardId, name, color ?? '#64748b', position ?? 0, agentActionPrompt ?? null, autoMove ? 1 : 0)
    const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(col as any))
  })

  app.put<{ Params: { id: string } }>('/api/columns/:id', async (req, reply) => {
    const { name, color, agentActionPrompt, autoMove, roleRequired } = req.body as any
    const existing = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Column not found' })
    db.prepare(`
      UPDATE columns SET name = ?, color = ?, agent_action_prompt = ?, auto_move = ?, role_required = ?
      WHERE id = ?
    `).run(
      name ?? existing.name, color ?? existing.color,
      agentActionPrompt !== undefined ? agentActionPrompt : existing.agent_action_prompt,
      autoMove !== undefined ? (autoMove ? 1 : 0) : existing.auto_move,
      roleRequired !== undefined ? roleRequired : existing.role_required,
      req.params.id,
    )
    const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(col as any))
  })

  app.put<{ Params: { boardId: string } }>('/api/boards/:boardId/columns/reorder', async (req, reply) => {
    const { columnIds } = req.body as { columnIds: string[] }
    const update = db.prepare('UPDATE columns SET position = ? WHERE id = ? AND board_id = ?')
    const tx = db.transaction(() => {
      for (let i = 0; i < columnIds.length; i++) {
        update.run(i, columnIds[i], req.params.boardId)
      }
    })
    tx()
    return reply.send({ success: true })
  })

  app.delete<{ Params: { id: string } }>('/api/columns/:id', async (req, reply) => {
    db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
