import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { requireRole } from '../middleware/auth.js'
import { TrelloClient } from '../services/trello-client.js'
import { TrelloImportService } from '../services/trello-import.js'

export async function trelloIntegrationRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')
  const adminOnly = requireRole('admin')

  // List all integrations (mask secrets for non-admin)
  app.get('/api/trello-integrations', async (req, reply) => {
    const rows = db.prepare('SELECT * FROM trello_integrations ORDER BY created_at DESC').all() as any[]
    const isAdmin = (req as any).user?.role === 'admin'
    const masked = rows.map((row: any) => {
      if (!isAdmin) {
        row.api_token = '•••'
        row.api_secret = row.api_secret ? '•••' : null
      }
      return row
    })
    return reply.send(toCamelCaseArray(masked))
  })

  // Helper: fetch lists from a Trello board (for UI mapping step)
  app.get('/api/trello-integrations/lists', { preHandler: [editorPlus] }, async (req, reply) => {
    const { apiKey, apiToken, boardId } = req.query as any
    if (!apiKey || !apiToken || !boardId) {
      return reply.status(400).send({ error: 'apiKey, apiToken, and boardId are required' })
    }
    const client = new TrelloClient(apiKey, apiToken)
    try {
      const lists = await client.getLists(boardId)
      return reply.send(lists)
    } catch (e: any) {
      return reply.status(400).send({ error: `Failed to fetch lists: ${e.message}` })
    }
  })

  // Create integration
  app.post('/api/trello-integrations', { preHandler: [editorPlus] }, async (req, reply) => {
    const { name, target, trelloBoardId, apiKey, apiToken, apiSecret, configJson } = req.body as any
    if (!name?.trim() || !target || !trelloBoardId || !apiKey || !apiToken) {
      return reply.status(400).send({ error: 'name, target, trelloBoardId, apiKey, apiToken are required' })
    }
    if (target !== 'bugs' && target !== 'dev') {
      return reply.status(400).send({ error: 'target must be "bugs" or "dev"' })
    }

    // Validate credentials
    const client = new TrelloClient(apiKey, apiToken)
    const valid = await client.validateCredentials()
    if (!valid) {
      return reply.status(400).send({ error: 'Invalid Trello credentials' })
    }

    const id = crypto.randomUUID()
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    db.prepare(`
      INSERT INTO trello_integrations (id, name, target, trello_board_id, api_key, api_token, api_secret, config_json, webhook_secret)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), target, trelloBoardId, apiKey, apiToken, apiSecret || null, configJson || '{}', webhookSecret)

    // Register webhook on Trello (requires PUBLIC_BASE_URL)
    const publicBaseUrl = process.env.PUBLIC_BASE_URL
    let trelloWebhookId: string | null = null
    if (publicBaseUrl) {
      try {
        const callbackURL = `${publicBaseUrl}/api/intake/trello/${id}?token=${webhookSecret}`
        trelloWebhookId = await client.createWebhook(callbackURL, trelloBoardId)
        db.prepare('UPDATE trello_integrations SET trello_webhook_id = ? WHERE id = ?').run(trelloWebhookId, id)
      } catch (e: any) {
        app.log.error(`Failed to register Trello webhook: ${e.message}`)
      }
    }

    // Trigger backfill in background
    const integration = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(id) as any
    const importService = new TrelloImportService(db)
    importService.backfill(integration, client).catch((e: any) => {
      app.log.error(`Backfill failed for integration ${id}: ${e.message}`)
    })

    const row = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(row as any))
  })

  // Manual backfill
  app.post<{ Params: { id: string } }>('/api/trello-integrations/:id/backfill', { preHandler: [editorPlus] }, async (req, reply) => {
    const integration = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(req.params.id) as any
    if (!integration) return reply.status(404).send({ error: 'Integration not found' })

    const client = new TrelloClient(integration.api_key, integration.api_token)
    const importService = new TrelloImportService(db)
    const result = await importService.backfill(integration, client)

    db.prepare("UPDATE trello_integrations SET last_backfill_at = datetime('now') WHERE id = ?").run(req.params.id)

    return reply.send(result)
  })

  // Update (toggle enabled, edit config)
  app.put<{ Params: { id: string } }>('/api/trello-integrations/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    const { enabled, configJson } = req.body as any
    const integration = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(req.params.id) as any
    if (!integration) return reply.status(404).send({ error: 'Integration not found' })

    if (enabled !== undefined) {
      db.prepare('UPDATE trello_integrations SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id)
    }
    if (configJson !== undefined) {
      db.prepare('UPDATE trello_integrations SET config_json = ? WHERE id = ?').run(configJson, req.params.id)
    }

    const updated = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(updated as any))
  })

  // Delete (admin only)
  app.delete<{ Params: { id: string } }>('/api/trello-integrations/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const integration = db.prepare('SELECT * FROM trello_integrations WHERE id = ?').get(req.params.id) as any
    if (!integration) return reply.status(404).send({ error: 'Integration not found' })

    // Best-effort webhook cleanup on Trello
    if (integration.trello_webhook_id) {
      try {
        const client = new TrelloClient(integration.api_key, integration.api_token)
        await client.deleteWebhook(integration.trello_webhook_id)
      } catch {
        // Best effort — Trello webhook may already be gone
      }
    }

    db.prepare('DELETE FROM trello_integrations WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
