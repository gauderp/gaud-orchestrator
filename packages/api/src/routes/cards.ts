import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { requireRole } from '../middleware/auth.js'
import { BOARD_IDS, SPEC_COLUMNS, DEV_COLUMNS } from '@gaud/shared'

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')

  app.get<{ Params: { boardId: string } }>('/api/boards/:boardId/cards', async (req, reply) => {
    const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(req.params.boardId) as any[]
    const cardIds = cards.map((c: any) => c.id)
    const allTags = cardIds.length > 0
      ? db.prepare(`SELECT * FROM card_tags WHERE card_id IN (${cardIds.map(() => '?').join(',')}) ORDER BY name`).all(...cardIds) as any[]
      : []
    const tagsByCard = new Map<string, any[]>()
    for (const tag of allTags) {
      const list = tagsByCard.get(tag.card_id) ?? []
      list.push(tag)
      tagsByCard.set(tag.card_id, list)
    }
    const result = cards.map((c: any) => ({
      ...toCamelCase<Record<string, unknown>>(c),
      tags: toCamelCaseArray(tagsByCard.get(c.id) ?? []),
    }))
    return reply.send(result)
  })

  app.get<{ Params: { id: string } }>('/api/cards/:id', async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })
    const repos = db.prepare('SELECT * FROM card_repos WHERE card_id = ?').all(req.params.id)
    const comments = db.prepare('SELECT * FROM card_comments WHERE card_id = ? ORDER BY created_at').all(req.params.id)
    const attachments = db.prepare('SELECT * FROM card_attachments WHERE card_id = ?').all(req.params.id)
    const children = db.prepare('SELECT * FROM cards WHERE parent_card_id = ? ORDER BY position').all(req.params.id)
    const dependencies = db.prepare('SELECT * FROM card_dependencies WHERE card_id = ?').all(req.params.id)
    const tags = db.prepare('SELECT * FROM card_tags WHERE card_id = ? ORDER BY name').all(req.params.id)
    return reply.send({
      ...toCamelCase<Record<string, unknown>>(card),
      repos: toCamelCaseArray(repos as any[]),
      comments: toCamelCaseArray(comments as any[]),
      attachments: toCamelCaseArray(attachments as any[]),
      children: toCamelCaseArray(children as any[]),
      dependencies: toCamelCaseArray(dependencies as any[]),
      tags: toCamelCaseArray(tags as any[]),
    })
  })

  app.post('/api/cards', { preHandler: [editorPlus] }, async (req, reply) => {
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

  app.put<{ Params: { id: string } }>('/api/cards/:id', { preHandler: [editorPlus] }, async (req, reply) => {
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

  app.put<{ Params: { id: string } }>('/api/cards/:id/move', { preHandler: [editorPlus] }, async (req, reply) => {
    const { columnId, position } = req.body as { columnId: string; position: number }
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Card not found' })
    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(columnId, position, now, req.params.id)
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id)
    const result = toCamelCase(card as any)
    broadcast('card:moved', result)

    return reply.send(result)
  })

  app.delete<{ Params: { id: string } }>('/api/cards/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id)
    broadcast('card:deleted', { id: req.params.id })
    return reply.status(204).send()
  })

  // Comments
  app.post<{ Params: { id: string } }>('/api/cards/:id/comments', { preHandler: [editorPlus] }, async (req, reply) => {
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
    const { repoPath, specPath, repositoryId } = req.body as any
    const repoId = randomUUID()
    // If repositoryId provided, resolve path from repositories table
    let resolvedPath = repoPath
    if (repositoryId) {
      const registered = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId) as any
      resolvedPath = registered?.local_path ?? repoPath
    }
    db.prepare('INSERT INTO card_repos (id, card_id, repo_path, spec_path, repository_id) VALUES (?, ?, ?, ?, ?)')
      .run(repoId, req.params.id, resolvedPath, specPath ?? null, repositoryId ?? null)
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

  // Tags
  app.post<{ Params: { id: string } }>('/api/cards/:id/tags', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name, color } = req.body as { name: string; color?: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'Tag name is required' })
    const id = randomUUID()
    db.prepare('INSERT INTO card_tags (id, card_id, name, color) VALUES (?, ?, ?, ?)')
      .run(id, req.params.id, name.trim(), color ?? '#64748B')
    const tag = toCamelCase(db.prepare('SELECT * FROM card_tags WHERE id = ?').get(id) as any)
    return reply.status(201).send(tag)
  })

  app.delete<{ Params: { id: string; tagId: string } }>('/api/cards/:id/tags/:tagId', { preHandler: [editorPlus] }, async (req, reply) => {
    db.prepare('DELETE FROM card_tags WHERE id = ? AND card_id = ?').run(req.params.tagId, req.params.id)
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
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    // Create a conversation for this interaction
    const convId = randomUUID()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(convId, req.params.id, 'research', now, now)

    // Add agent as participant
    db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
      .run(convId, agentId)

    // Build context from card
    const repos = (db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(req.params.id) as any[])
      .map((r: any) => r.repo_path)
    const cardContext = `Card: ${card.title}\n${card.description ?? ''}\nRepos: ${repos.join(', ')}`

    // Seed conversation with user prompt + card context
    db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), convId, 'user', `${prompt}\n\n## Card Context\n${cardContext}`, 'content')

    broadcast('conversation:status', { conversationId: convId, status: 'active' })

    // Trigger first agent turn
    const registry = (app as any).providerRegistry
    if (registry) {
      try {
        const { runConversationTurn } = await import('../services/conversation-runner.js')
        await runConversationTurn(db, convId, registry)
      } catch (err: any) {
        console.error('Ask agent failed:', err)
      }
    }

    return reply.status(201).send({ conversationId: convId, cardId: req.params.id, agentId })
  })

  // Move card to a different board
  app.post<{ Params: { id: string } }>('/api/cards/:id/move-to-board', { preHandler: [editorPlus] }, async (req, reply) => {
    const { boardId, columnId } = req.body as { boardId: string; columnId: string }
    if (!boardId || !columnId) return reply.status(400).send({ error: 'boardId and columnId are required' })

    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Card not found' })

    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId) as any
    if (!board) return reply.status(404).send({ error: 'Target board not found' })

    const column = db.prepare('SELECT * FROM columns WHERE id = ? AND board_id = ?').get(columnId, boardId) as any
    if (!column) return reply.status(404).send({ error: 'Target column not found in board' })

    const now = new Date().toISOString()
    const maxPos = db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(columnId) as any
    const position = (maxPos?.mp ?? -1) + 1

    db.prepare('UPDATE cards SET board_id = ?, column_id = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(boardId, columnId, position, now, req.params.id)

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id)
    const result = toCamelCase(card as any)
    broadcast('card:moved', result)
    return reply.send(result)
  })

  app.post<{ Params: { id: string } }>('/api/cards/:id/estimate', async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    const repos = db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(req.params.id) as any[]
    const repoList = repos.map((r: any) => r.repo_path).join(', ')

    // Use codebase analyzer for context
    let codebaseInfo = ''
    if (repos.length > 0) {
      try {
        const { analyzeCodebase } = await import('../services/codebase-analyzer.js')
        const analysis = await analyzeCodebase(repos[0].repo_path)
        codebaseInfo = `\n\nCodebase: ${analysis.fileCount} files, ${analysis.routes.length} routes, ${analysis.exports.length} exports`
      } catch { /* optional */ }
    }

    // Simple heuristic estimate based on description length and repos
    const descLength = (card.description ?? '').length
    const estimatedTokens = Math.max(5000, descLength * 10 + repos.length * 20000)
    const estimatedCostUsd = estimatedTokens * 0.000015 // ~$15/1M tokens average

    db.prepare('UPDATE cards SET estimated_tokens = ?, estimated_cost_usd = ?, updated_at = datetime("now") WHERE id = ?')
      .run(estimatedTokens, estimatedCostUsd, req.params.id)

    const updated = toCamelCase(db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any)
    broadcast('card:updated', updated)
    return reply.send({
      estimatedTokens,
      estimatedCostUsd,
      details: `Based on description (${descLength} chars), ${repos.length} repo(s)${codebaseInfo}`,
    })
  })

  // Send card from Triage → Dev: To Do
  app.post<{ Params: { id: string } }>('/api/cards/:id/send-to-dev', { preHandler: [editorPlus] }, async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET board_id = ?, column_id = ?, updated_at = ? WHERE id = ?')
      .run(BOARD_IDS.DEV, DEV_COLUMNS.TODO, now, card.id)

    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), card.id, 'system', 'system', 'Sent to Development from Triage', now)

    const updated = toCamelCase(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id) as any)
    broadcast('card:moved', updated)
    return reply.send(updated)
  })

  // Send card from Triage → Spec: Ideas (bug becomes feature request)
  app.post<{ Params: { id: string } }>('/api/cards/:id/send-to-spec', { preHandler: [editorPlus] }, async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })

    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET board_id = ?, column_id = ?, type = ?, updated_at = ? WHERE id = ?')
      .run(BOARD_IDS.SPEC, SPEC_COLUMNS.IDEAS, 'task', now, card.id)

    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), card.id, 'system', 'system', 'Converted to feature request — sent to Spec', now)

    const updated = toCamelCase(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id) as any)
    broadcast('card:moved', updated)
    return reply.send(updated)
  })

  // Reopen card: Dev Done → Dev To Do
  app.post<{ Params: { id: string } }>('/api/cards/:id/reopen', { preHandler: [editorPlus] }, async (req, reply) => {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as any
    if (!card) return reply.status(404).send({ error: 'Card not found' })
    if (card.column_id !== DEV_COLUMNS.DONE) {
      return reply.status(400).send({ error: 'Only cards in Done can be reopened' })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE cards SET column_id = ?, completed_at = NULL, updated_at = ? WHERE id = ?')
      .run(DEV_COLUMNS.TODO, now, card.id)

    const reason = (req.body as any)?.reason || 'Reopened'
    db.prepare(
      'INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), card.id, 'system', 'system', `Reopened: ${reason}`, now)

    const updated = toCamelCase(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id) as any)
    broadcast('card:moved', updated)
    return reply.send(updated)
  })
}
