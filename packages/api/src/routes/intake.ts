import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { getDb } from '../db/connection.js'
import { getAdapter } from '../intake/registry.js'
import { broadcast } from '../ws/broadcast.js'
import { BOARD_IDS, TRIAGE_COLUMNS } from '@gaud/shared'
import type { BugSourceRow } from '../intake/types.js'
import { randomUUID } from 'crypto'

export function intakeRoutes(app: FastifyInstance) {
  const db = getDb()

  // Trello sends HEAD/GET to validate webhook URL on registration
  app.head('/api/intake/bugs/:sourceId', async (_req, reply) => {
    return reply.status(200).send()
  })

  app.get('/api/intake/bugs/:sourceId', async (_req, reply) => {
    return reply.status(200).send()
  })

  // Main webhook endpoint — public, no JWT
  app.post<{ Params: { sourceId: string }; Querystring: { token?: string } }>(
    '/api/intake/bugs/:sourceId',
    async (req, reply) => {
      const { sourceId } = req.params
      const token = (req.query as any).token as string

      // 1. Validate source
      const source = db.prepare(
        'SELECT * FROM bug_sources WHERE id = ? AND enabled = 1'
      ).get(sourceId) as BugSourceRow | undefined
      if (!source) return reply.status(404).send({ error: 'Source not found or disabled' })

      // 2. Validate token
      if (!token || token.length !== source.webhook_secret.length) {
        return reply.status(401).send({ error: 'Invalid token' })
      }
      try {
        if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(source.webhook_secret))) {
          return reply.status(401).send({ error: 'Invalid token' })
        }
      } catch {
        return reply.status(401).send({ error: 'Invalid token' })
      }

      // 3. Get adapter
      const adapter = getAdapter(source.type)
      if (!adapter) return reply.status(400).send({ error: `No adapter for type: ${source.type}` })

      // 4. Adapter-specific verification (e.g., Trello HMAC)
      if (!adapter.verify(req, source)) {
        return reply.status(401).send({ error: 'Adapter verification failed' })
      }

      // 5. Normalize
      const normalized = adapter.normalize(req.body, source)
      if (!normalized) {
        return reply.status(200).send({ ignored: true })
      }

      // 6. Dedup
      if (normalized.externalId) {
        const existing = db.prepare(
          'SELECT id FROM bug_reports WHERE source_id = ? AND external_id = ?'
        ).get(source.id, normalized.externalId) as any
        if (existing) {
          db.prepare(
            "UPDATE bug_reports SET description = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(normalized.description, existing.id)
          return reply.status(200).send({ deduplicated: true, reportId: existing.id })
        }
      }

      // 7. Create bug report + card
      const reportId = randomUUID()
      const cardId = randomUUID()
      const conversationId = randomUUID()

      db.prepare(
        "INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'research', datetime('now'), datetime('now'))"
      ).run(conversationId)

      const maxPos = db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(TRIAGE_COLUMNS.NEW) as any
      const position = (maxPos?.mp ?? -1) + 1

      db.prepare(
        "INSERT INTO cards (id, board_id, column_id, type, title, description, position, created_at, updated_at) VALUES (?, ?, ?, 'bug', ?, ?, ?, datetime('now'), datetime('now'))"
      ).run(cardId, BOARD_IDS.TRIAGE, TRIAGE_COLUMNS.NEW, normalized.title, normalized.description, position)

      db.prepare(`
        INSERT INTO bug_reports (id, title, description, reporter_name, reporter_email, source, severity, card_id, conversation_id, source_id, external_id, external_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        reportId, normalized.title, normalized.description,
        normalized.reporterName || null, normalized.reporterEmail || null,
        source.type, normalized.severity || null,
        cardId, conversationId, source.id,
        normalized.externalId || null, normalized.externalUrl || null
      )

      broadcast('card:created', { id: cardId, boardId: BOARD_IDS.TRIAGE, columnId: TRIAGE_COLUMNS.NEW })
      broadcast('bug_report:created', { id: reportId, sourceType: source.type })

      return reply.status(201).send({ reportId, cardId })
    }
  )
}
