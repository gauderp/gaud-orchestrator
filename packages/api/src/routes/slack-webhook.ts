import type { FastifyInstance } from 'fastify'
import { BugTriageService } from '../services/bug-triage.js'

export async function slackWebhookRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const triage = new BugTriageService(db)

  // Slack bug report webhook — zero LLM cost at intake
  app.post('/api/webhooks/slack/bug', async (req, reply) => {
    const payload = req.body as any

    // Slack URL verification challenge
    if (payload.challenge) return reply.send({ challenge: payload.challenge })

    const event = payload.event
    if (!event?.text) return reply.status(200).send({ ok: true })

    const title = event.text.substring(0, 100)
    const description = event.text
    const reporterName = event.user_name ?? event.user ?? 'Slack user'

    triage.createReport({
      title,
      description,
      reporterName,
      source: 'slack',
    })

    return reply.status(200).send({ ok: true })
  })
}
