import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { requireRole } from '../middleware/auth.js'
import { BOARD_IDS, SPEC_COLUMNS, DEV_COLUMNS } from '@gaud/shared'

export async function specRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')

  // List specs — join with cards to get column info
  app.get('/api/specs', async (req, reply) => {
    const specs = db.prepare(`
      SELECT s.*, c.column_id, c.board_id
      FROM specs s
      LEFT JOIN cards c ON c.id = s.card_id
      ORDER BY s.updated_at DESC
    `).all()
    return reply.send(toCamelCaseArray(specs as any[]))
  })

  // Get spec with reviews
  app.get<{ Params: { id: string } }>('/api/specs/:id', async (req, reply) => {
    const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!spec) return reply.status(404).send({ error: 'Spec not found' })
    const reviews = db.prepare('SELECT * FROM spec_reviews WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
    const repos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
    return reply.send({
      ...toCamelCase<Record<string, unknown>>(spec as Record<string, unknown>),
      reviews: toCamelCaseArray(reviews as any[]),
      repos: toCamelCaseArray(repos as any[]),
    })
  })

  // Create spec (manual) — also creates a card on the Spec board
  app.post('/api/specs', { preHandler: [editorPlus] }, async (req, reply) => {
    const { title, content, createdByType, createdById } = req.body as any
    const id = randomUUID()
    const cardId = randomUUID()
    const now = new Date().toISOString()

    // Create card on Spec board: Ideas
    const maxPos = db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(SPEC_COLUMNS.IDEAS) as any
    const position = (maxPos?.mp ?? -1) + 1
    db.prepare('INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(cardId, BOARD_IDS.SPEC, SPEC_COLUMNS.IDEAS, 'task', title, position, now, now)

    db.prepare(`
      INSERT INTO specs (id, title, content, card_id, created_by_type, created_by_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, content ?? '', cardId, createdByType ?? 'user', createdById ?? null, now, now)

    const spec = toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(id) as any)
    broadcast('spec:updated', spec)
    broadcast('card:created', { id: cardId, boardId: BOARD_IDS.SPEC })
    return reply.status(201).send(spec)
  })

  // Update spec (creates new version)
  app.put<{ Params: { id: string } }>('/api/specs/:id', { preHandler: [editorPlus] }, async (req, reply) => {
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

  // Submit review (approve/reject/comment) — moves card column instead of updating status
  app.post<{ Params: { id: string } }>('/api/specs/:id/review', { preHandler: [editorPlus] }, async (req, reply) => {
    const { reviewerType, reviewerId, verdict, comment } = req.body as any
    const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!spec) return reply.status(404).send({ error: 'Spec not found' })

    const reviewId = randomUUID()
    db.prepare(`
      INSERT INTO spec_reviews (id, spec_id, reviewer_type, reviewer_id, verdict, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reviewId, req.params.id, reviewerType, reviewerId ?? null, verdict, comment ?? null)

    // Move card based on verdict
    if (verdict === 'approve' && spec.card_id) {
      db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(SPEC_COLUMNS.APPROVED, spec.card_id)
      broadcast('card:moved', { id: spec.card_id, columnId: SPEC_COLUMNS.APPROVED })
    } else if (verdict === 'reject' && spec.card_id) {
      db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(SPEC_COLUMNS.DRAFTING, spec.card_id)
      broadcast('card:moved', { id: spec.card_id, columnId: SPEC_COLUMNS.DRAFTING })
    }

    db.prepare("UPDATE specs SET updated_at = datetime('now') WHERE id = ?").run(req.params.id)
    broadcast('spec:updated', toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any))

    const review = toCamelCase(db.prepare('SELECT * FROM spec_reviews WHERE id = ?').get(reviewId) as any)
    return reply.status(201).send(review)
  })

  // Generate spec via conversation (delegates to Conversation Engine)
  app.post('/api/specs/generate', { preHandler: [editorPlus] }, async (req, reply) => {
    const { title, description, repos, agentIds, cardId } = req.body as any
    if (!agentIds || agentIds.length === 0) {
      return reply.status(400).send({ error: 'At least one agent is required' })
    }

    // 1. Create or reuse a card on the Spec board: Drafting
    const specId = randomUUID()
    const now = new Date().toISOString()

    let specCardId = cardId
    if (!specCardId) {
      specCardId = randomUUID()
      db.prepare('INSERT INTO cards (id, board_id, column_id, type, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
        .run(specCardId, BOARD_IDS.SPEC, SPEC_COLUMNS.DRAFTING, 'task', title, now, now)
    } else {
      // Move existing card to Drafting
      db.prepare("UPDATE cards SET board_id = ?, column_id = ?, updated_at = ? WHERE id = ?")
        .run(BOARD_IDS.SPEC, SPEC_COLUMNS.DRAFTING, now, specCardId)
    }

    db.prepare(`
      INSERT INTO specs (id, title, content, card_id, created_by_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'agent', ?, ?)
    `).run(specId, title, `Generating spec for: ${description}`, specCardId, now, now)

    // 2. Create a conversation (type: spec) linked to the card
    const convId = randomUUID()
    db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(convId, specCardId, 'spec', now, now)
    for (const agentId of agentIds) {
      db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)').run(convId, agentId)
    }

    // 3. Seed the conversation with context
    const seedContent = `Generate a detailed technical specification for: "${title}"\n\nDescription: ${description}\n\nRepositories: ${(repos ?? []).join(', ')}\n\nAnalyze the codebase, discuss the approach, and produce the spec as an [ARTIFACT].`
    db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), convId, 'system', seedContent, 'content')

    // Persist linked repos
    const repoList = repos ?? []
    for (const repoPath of repoList) {
      const registered = db.prepare('SELECT id FROM repositories WHERE github_url = ?').get(repoPath) as any
      db.prepare('INSERT INTO spec_repos (id, spec_id, repo_path, repository_id) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), specId, repoPath, registered?.id ?? null)
    }

    const spec = toCamelCase(db.prepare('SELECT * FROM specs WHERE id = ?').get(specId) as any)
    broadcast('spec:updated', spec)

    return reply.status(201).send({
      spec,
      conversationId: convId,
      message: 'Conversation started. Trigger /api/conversations/' + convId + '/next-turn to begin agent collaboration.',
    })
  })

  // List repos for a spec
  app.get<{ Params: { id: string } }>('/api/specs/:id/repos', async (req, reply) => {
    const repos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
    return reply.send(toCamelCaseArray(repos as any[]))
  })

  // Add repo to spec
  app.post<{ Params: { id: string } }>('/api/specs/:id/repos', async (req, reply) => {
    const { repoPath, repositoryId } = req.body as { repoPath: string; repositoryId?: string }
    const id = randomUUID()
    db.prepare('INSERT INTO spec_repos (id, spec_id, repo_path, repository_id) VALUES (?, ?, ?, ?)').run(id, req.params.id, repoPath, repositoryId ?? null)
    const repo = toCamelCase(db.prepare('SELECT * FROM spec_repos WHERE id = ?').get(id) as any)
    return reply.status(201).send(repo)
  })

  // Remove repo from spec
  app.delete<{ Params: { id: string; repoId: string } }>('/api/specs/:id/repos/:repoId', async (req, reply) => {
    db.prepare('DELETE FROM spec_repos WHERE id = ? AND spec_id = ?').run(req.params.repoId, req.params.id)
    return reply.status(204).send()
  })

  // Decompose approved spec into cards
  app.post<{ Params: { id: string } }>('/api/specs/:id/decompose', { preHandler: [editorPlus] }, async (req, reply) => {
    const spec = db.prepare('SELECT * FROM specs WHERE id = ?').get(req.params.id) as any
    if (!spec) return reply.status(404).send({ error: 'Spec not found' })

    // Check spec's card is in Approved column
    const specCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(spec.card_id) as any
    if (!specCard || specCard.column_id !== SPEC_COLUMNS.APPROVED) {
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
        provider.onOutput(session.id, (event: { type: string; content: string }) => {
          if (event.type === 'stdout') responseText += event.content
        })
        setTimeout(resolve, 120_000)
        const check = setInterval(() => {
          if (responseText.includes('"tasks"')) { clearInterval(check); setTimeout(resolve, 2000) }
        }, 1000)
      })

      const tasks = parseDecomposition(responseText)

      // Create cards from tasks on the Dev board: Todo
      const createdCards: any[] = []
      const titleToId = new Map<string, string>()

      for (const task of tasks) {
        const cardId = randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO cards (id, board_id, column_id, parent_card_id, type, title, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cardId, BOARD_IDS.DEV, DEV_COLUMNS.TODO, spec.card_id, task.type, task.title, task.description, now, now)
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

      // Propagate spec repos to created cards
      const specRepos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ?').all(req.params.id) as any[]
      for (const card of createdCards) {
        for (const sr of specRepos) {
          db.prepare('INSERT INTO card_repos (id, card_id, repo_path, repository_id) VALUES (?, ?, ?, ?)')
            .run(randomUUID(), card.id, sr.repo_path, sr.repository_id)
        }
      }

      return reply.send({ specId: req.params.id, boardId: BOARD_IDS.DEV, cards: createdCards })
    } catch (err: any) {
      return reply.status(500).send({ error: `Decomposition failed: ${err.message}` })
    }
  })
}
