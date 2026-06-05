import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/cards', async (req, reply) => {
    const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(req.params.boardId)
    return reply.send(toCamelCaseArray(cards as any[]))
  })

  app.get<{ Params: { id: string } }>('/api/cards/:id', async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })
    const repos = db.prepare('SELECT * FROM card_repos WHERE card_id = ?').all(req.params.id)
    const comments = db.prepare('SELECT * FROM card_comments WHERE card_id = ? ORDER BY created_at').all(req.params.id)
    const attachments = db.prepare('SELECT * FROM card_attachments WHERE card_id = ?').all(req.params.id)
    const children = db.prepare('SELECT * FROM cards WHERE parent_card_id = ? ORDER BY position').all(req.params.id)
    const dependencies = db.prepare('SELECT * FROM card_dependencies WHERE card_id = ?').all(req.params.id)
    return reply.send({
      ...toCamelCase<Record<string, unknown>>(card),
      repos: toCamelCaseArray(repos as any[]),
      comments: toCamelCaseArray(comments as any[]),
      attachments: toCamelCaseArray(attachments as any[]),
      children: toCamelCaseArray(children as any[]),
      dependencies: toCamelCaseArray(dependencies as any[]),
    })
  })

  app.post('/api/cards', async (req, reply) => {
    const { boardId, columnId, parentCardId, type, title, description, assignedAgentId,
      estimatedTokens, estimatedCostUsd, startDate, dueDate } = req.body as any
    const id = randomUUID()
    const now = new Date().toISOString()
    const maxPos = db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(columnId) as any
    const position = (maxPos?.mp ?? -1) + 1
    db.prepare(`
      INSERT INTO cards (id, board_id, column_id, parent_card_id, type, title, description,
        assigned_agent_id, estimated_tokens, estimated_cost_usd, position, start_date, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, boardId, columnId, parentCardId ?? null, type, title, description ?? null,
      assignedAgentId ?? null, estimatedTokens ?? null, estimatedCostUsd ?? null,
      position, startDate ?? null, dueDate ?? null, now, now)
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id)
    const result = toCamelCase(card as any)
    broadcast('card:created', result)
    return reply.status(201).send(result)
  })

  app.put<{ Params: { id: string } }>('/api/cards/:id', async (req, reply) => {
    const fields = req.body as any
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Card not found' })
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE cards SET title = ?, description = ?, type = ?, assigned_agent_id = ?,
        estimated_tokens = ?, estimated_cost_usd = ?, start_date = ?, due_date = ?,
        parent_card_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      fields.title ?? existing.title, fields.description ?? existing.description,
      fields.type ?? existing.type, fields.assignedAgentId ?? existing.assigned_agent_id,
      fields.estimatedTokens ?? existing.estimated_tokens, fields.estimatedCostUsd ?? existing.estimated_cost_usd,
      fields.startDate ?? existing.start_date, fields.dueDate ?? existing.due_date,
      fields.parentCardId ?? existing.parent_card_id, now, req.params.id,
    )
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id)
    const result = toCamelCase(card as any)
    broadcast('card:updated', result)
    return reply.send(result)
  })

  app.put<{ Params: { id: string } }>('/api/cards/:id/move', async (req, reply) => {
    const { columnId, position } = req.body as { columnId: string; position: number }
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Card not found' })
    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(columnId, position, now, req.params.id)
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id)
    const result = toCamelCase(card as any)
    broadcast('card:moved', result)

    const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId) as any
    if (column?.agent_action_prompt) {
      import('../services/column-action.js').then(({ executeColumnAction }) => {
        executeColumnAction(db, req.params.id, column).catch((err: any) => {
          console.error('Column action failed:', err)
        })
      })
    }

    return reply.send(result)
  })

  app.delete<{ Params: { id: string } }>('/api/cards/:id', async (req, reply) => {
    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id)
    broadcast('card:deleted', { id: req.params.id })
    return reply.status(204).send()
  })

  // Comments
  app.post<{ Params: { id: string } }>('/api/cards/:id/comments', async (req, reply) => {
    const { authorType, authorId, content } = req.body as any
    const commentId = randomUUID()
    db.prepare('INSERT INTO card_comments (id, card_id, author_type, author_id, content) VALUES (?, ?, ?, ?, ?)')
      .run(commentId, req.params.id, authorType, authorId ?? null, content)
    const comment = db.prepare('SELECT * FROM card_comments WHERE id = ?').get(commentId)
    const result = toCamelCase(comment as any)
    broadcast('card:comment', { cardId: req.params.id, comment: result })
    return reply.status(201).send(result)
  })

  // Repos
  app.post<{ Params: { id: string } }>('/api/cards/:id/repos', async (req, reply) => {
    const { repoPath, specPath } = req.body as any
    const repoId = randomUUID()
    db.prepare('INSERT INTO card_repos (id, card_id, repo_path, spec_path) VALUES (?, ?, ?, ?)')
      .run(repoId, req.params.id, repoPath, specPath ?? null)
    const repo = db.prepare('SELECT * FROM card_repos WHERE id = ?').get(repoId)
    return reply.status(201).send(toCamelCase(repo as any))
  })

  app.delete<{ Params: { id: string; repoId: string } }>('/api/cards/:id/repos/:repoId', async (req, reply) => {
    db.prepare('DELETE FROM card_repos WHERE id = ? AND card_id = ?').run(req.params.repoId, req.params.id)
    return reply.status(204).send()
  })

  // Dependencies
  app.post<{ Params: { id: string } }>('/api/cards/:id/dependencies', async (req, reply) => {
    const { dependsOnCardId } = req.body as { dependsOnCardId: string }
    db.prepare('INSERT INTO card_dependencies (card_id, depends_on_card_id) VALUES (?, ?)')
      .run(req.params.id, dependsOnCardId)
    return reply.status(201).send({ cardId: req.params.id, dependsOnCardId })
  })

  app.delete<{ Params: { id: string; depId: string } }>('/api/cards/:id/dependencies/:depId', async (req, reply) => {
    db.prepare('DELETE FROM card_dependencies WHERE card_id = ? AND depends_on_card_id = ?')
      .run(req.params.id, req.params.depId)
    return reply.status(204).send()
  })

  // Gantt data
  app.get<{ Params: { id: string } }>('/api/boards/:id/gantt', async (req, reply) => {
    const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(req.params.id)
    const deps = db.prepare(`
      SELECT cd.* FROM card_dependencies cd
      JOIN cards c ON c.id = cd.card_id
      WHERE c.board_id = ?
    `).all(req.params.id)
    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id)
    return reply.send({
      cards: toCamelCaseArray(cards as any[]),
      dependencies: toCamelCaseArray(deps as any[]),
      columns: toCamelCaseArray(columns as any[]),
    })
  })

  app.post<{ Params: { id: string } }>('/api/cards/:id/ask-agent', async (req, reply) => {
    const { agentId, prompt } = req.body as { agentId: string; prompt: string }
    const commentId = randomUUID()
    db.prepare('INSERT INTO card_comments (id, card_id, author_type, author_id, content) VALUES (?, ?, ?, ?, ?)')
      .run(commentId, req.params.id, 'system', null, `Agent ${agentId} requested: ${prompt}`)
    broadcast('card:comment', { cardId: req.params.id })
    return reply.send({ status: 'queued', message: 'Agent action will be implemented in Phase 4/7' })
  })

  app.post<{ Params: { id: string } }>('/api/cards/:id/estimate', async (req, reply) => {
    return reply.send({ status: 'not_implemented', message: 'Cost estimation will be implemented in Phase 7' })
  })
}
