import type { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { TrelloImportService } from '../services/trello-import.js'

export async function trelloWebhookRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  // Trello sends HEAD to validate callback URL on webhook registration
  app.head('/api/intake/trello/:integrationId', async (_req, reply) => {
    return reply.status(200).send()
  })

  // Also responds to GET for the same reason
  app.get('/api/intake/trello/:integrationId', async (_req, reply) => {
    return reply.status(200).send()
  })

  // Main webhook endpoint
  app.post<{ Params: { integrationId: string }; Querystring: { token?: string } }>(
    '/api/intake/trello/:integrationId',
    { config: { rawBody: true } },
    async (req, reply) => {
      const { integrationId } = req.params
      const token = (req.query as any).token as string | undefined

      // 1. Find enabled integration
      const integration = db.prepare(
        'SELECT * FROM trello_integrations WHERE id = ? AND enabled = 1'
      ).get(integrationId) as any
      if (!integration) return reply.status(404).send({ error: 'Integration not found or disabled' })

      // 2. Validate token from query string
      if (!token || token.length !== integration.webhook_secret.length) {
        return reply.status(401).send({ error: 'Invalid token' })
      }
      try {
        if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(integration.webhook_secret))) {
          return reply.status(401).send({ error: 'Invalid token' })
        }
      } catch {
        return reply.status(401).send({ error: 'Invalid token' })
      }

      // 3. HMAC-SHA1 verification — MANDATORY when api_secret is configured.
      // If skipping were allowed on a missing header, an attacker holding the
      // webhook URL could bypass HMAC entirely by simply not sending it.
      if (integration.api_secret) {
        const signature = req.headers['x-trello-webhook'] as string | undefined
        const rawBody = (req as any).rawBody as string | undefined
        if (!signature || !rawBody) {
          return reply.status(401).send({ error: 'HMAC signature required' })
        }

        // Trello signs: rawBody + callbackURL
        const publicBaseUrl = process.env.PUBLIC_BASE_URL
        const callbackURL = publicBaseUrl
          ? `${publicBaseUrl}${req.url}`
          : `${req.protocol}://${req.hostname}${req.url}`

        const expected = crypto
          .createHmac('sha1', integration.api_secret)
          .update(rawBody + callbackURL)
          .digest('base64')

        try {
          if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return reply.status(401).send({ error: 'HMAC verification failed' })
          }
        } catch {
          return reply.status(401).send({ error: 'HMAC verification failed' })
        }
      }

      // 4. Process the event
      const importService = new TrelloImportService(db)
      const result = importService.handleWebhookEvent(integration, req.body)

      return reply.status(200).send({ result })
    }
  )
}
