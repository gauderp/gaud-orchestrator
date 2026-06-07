import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function specRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  // List specs (optional status filter)
  app.get<{ Querystring: { status?: string } }>('/api/specs', async (req, reply) => {
    let sql = 'SELECT * FROM specs'
    const params: any[] = []
    if (req.query.status) { sql += ' WHERE status = ?'; params.push(req.query.status) }
    sql += ' ORDER BY updated_at DESC'
    const specs = db.prepare(sql).all(...params)
    return reply.send(toCamelCaseArray(specs as any[]))
  })

  // Get spec with reviews
  app.get<{ Params: { id: string } }>('/api/specs/:id', async (req, reply) => {
    const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!spec) return reply.status(404).send({ error: 'Spec not found' })
    const reviews = db.prepare('SELECT * FROM spec_reviews WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
    return reply.send({
      ...toCamelCase(spec),
      reviews: toCamelCaseArray(reviews as any[]),
    })
  })

  // Create spec (manual)
  app.post('/api/specs', async (req, reply) => {
    const { title, content, sourceCardId, createdByType, createdById } = req.body as any
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO specs (id, title, content, source_card_id, created_by_type, created_by_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, content, sourceCardId ?? null, createdByType ?? 'user', createdById ?? null, now, now)
    const spec = toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(id) as any)
    broadcast('spec:updated', spec)
    return reply.status(201).send(spec)
  })

  // Update spec (creates new version)
  app.put<{ Params: { id: string } }>('/api/specs/:id', async (req, reply) => {
    const { title, content } = req.body as any
    const existing = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'Spec not found' })
    const now = new Date().toISOString()
    const newVersion = existing.version + 1
    db.prepare(`
      UPDATE specs SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?
    `).run(title ?? existing.title, content ?? existing.content, newVersion, now, req.params.id)
    const spec = toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any)
    broadcast('spec:updated', spec)
    return reply.send(spec)
  })

  // Submit review (approve/reject/comment)
  app.post<{ Params: { id: string } }>('/api/specs/:id/review', async (req, reply) => {
    const { reviewerType, reviewerId, verdict, comment } = req.body as any
    const reviewId = randomUUID()
    db.prepare(`
      INSERT INTO spec_reviews (id, spec_id, reviewer_type, reviewer_id, verdict, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reviewId, req.params.id, reviewerType, reviewerId ?? null, verdict, comment ?? null)

    // If verdict is approve or reject, update spec status
    if (verdict === 'approve') {
      db.prepare("UPDATE specs SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run('approved', req.params.id)
      broadcast('spec:updated', toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any))
    } else if (verdict === 'reject') {
      db.prepare("UPDATE specs SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run('rejected', req.params.id)
      broadcast('spec:updated', toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any))
    }

    const review = toCamelCase(db.prepare('SELECT * FROM spec_reviews WHERE id = ?').get(reviewId) as any)
    return reply.status(201).send(review)
  })

  // Generate spec via conversation (delegates to Conversation Engine)
  app.post('/api/specs/generate', async (req, reply) => {
    const { title, description, repos, agentIds, cardId } = req.body as any
    if (!agentIds || agentIds.length === 0) {
      return reply.status(400).send({ error: 'At least one agent is required' })
    }

    // 1. Create a draft spec
    const specId = randomUUID()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO specs (id, title, content, status, source_card_id, created_by_type, created_at, updated_at)
      VALUES (?, ?, ?, 'draft', ?, 'agent', ?, ?)
    `).run(specId, title, `Generating spec for: ${description}`, cardId ?? null, now, now)

    // 2. Create a conversation (type: spec) linked to the card
    const convId = randomUUID()
    db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(convId, cardId ?? null, 'spec', now, now)
    for (const agentId of agentIds) {
      db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)').run(convId, agentId)
    }

    // 3. Seed the conversation with context
    const seedContent = `Generate a detailed technical specification for: "${title}"\n\nDescription: ${description}\n\nRepositories: ${(repos ?? []).join(', ')}\n\nAnalyze the codebase, discuss the approach, and produce the spec as an [ARTIFACT].`
    db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), convId, 'system', seedContent, 'content')

    const spec = toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(specId) as any)
    broadcast('spec:updated', spec)

    return reply.status(201).send({
      spec,
      conversationId: convId,
      message: 'Conversation started. Trigger /api/conversations/' + convId + '/next-turn to begin agent collaboration.',
    })
  })

  // Decompose approved spec into cards
  app.post<{ Params: { id: string } }>('/api/specs/:id/decompose', async (req, reply) => {
    const { boardId, columnId } = req.body as { boardId: string; columnId: string }
    const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!spec) return reply.status(404).send({ error: 'Spec not found' })
    if (spec.status !== 'approved') {
      return reply.status(400).send({ error: 'Spec must be approved before decomposition' })
    }

    // Use LLM to decompose
    try {
      const { buildDecomposePrompt, parseDecomposition } = await import('../services/spec-decomposer.js')

      // Get available agents
      const agents = db.prepare('SELECT name FROM agents').all() as any[]
      const agentNames = agents.map((a: any) => a.name)

      const prompt = buildDecomposePrompt(spec.content, agentNames)

      // Call LLM via shared registry
      const registry = (app as any).providerRegistry
      if (!registry) return reply.status(500).send({ error: 'No providers configured' })
      const providers = registry.list()
      const provider = providers[0]
      if (!provider) return reply.status(500).send({ error: 'No providers available' })

      let responseText = ''
      const session = await provider.spawn({ prompt, cwd: process.cwd() })
      await new Promise<void>((resolve) => {
        provider.onOutput(session.id, (event) => {
          if (event.type === 'stdout') responseText += event.content
        })
        setTimeout(resolve, 120_000)
        const check = setInterval(() => {
          if (responseText.includes('"tasks"')) { clearInterval(check); setTimeout(resolve, 2000) }
        }, 1000)
      })

      const tasks = parseDecomposition(responseText)

      // Create cards from tasks
      const createdCards: any[] = []
      const titleToId = new Map<string, string>()

      for (const task of tasks) {
        const cardId = randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO cards (id, board_id, column_id, type, title, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cardId, boardId, columnId, task.type, task.title, task.description, now, now)
        titleToId.set(task.title, cardId)
        createdCards.push({ id: cardId, title: task.title, type: task.type, agent: task.agent })
      }

      // Create dependencies
      for (const task of tasks) {
        const cardId = titleToId.get(task.title)
        if (!cardId) continue
        for (const depTitle of task.dependsOn) {
          const depId = titleToId.get(depTitle)
          if (depId) {
            db.prepare('INSERT INTO card_dependencies (card_id, depends_on_card_id) VALUES (?, ?)').run(cardId, depId)
          }
        }
      }

      return reply.send({ specId: req.params.id, boardId, cards: createdCards })
    } catch (err: any) {
      return reply.status(500).send({ error: `Decomposition failed: ${err.message}` })
    }
  })
}
