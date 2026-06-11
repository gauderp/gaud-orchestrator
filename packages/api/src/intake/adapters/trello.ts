import crypto from 'crypto'
import type { FastifyRequest } from 'fastify'
import type { BugSourceAdapter, BugSourceRow } from '../types.js'
import type { NormalizedBugIntake } from '@gaud/shared'

const CARD_ACTIONS = new Set(['createCard', 'updateCard'])

export const trelloAdapter: BugSourceAdapter = {
  type: 'trello',

  verify(req: FastifyRequest, source: BugSourceRow): boolean {
    const signature = req.headers['x-trello-webhook'] as string
    if (!signature) return false

    const callbackURL = `${req.protocol}://${req.hostname}${req.url}`
    const rawBody = (req as any).rawBody || JSON.stringify(req.body)
    const expected = crypto
      .createHmac('sha1', source.webhook_secret)
      .update(rawBody + callbackURL)
      .digest('base64')

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expected, 'base64')
      )
    } catch {
      return false
    }
  },

  normalize(payload: unknown, source: BugSourceRow): NormalizedBugIntake | null {
    const p = payload as any
    const action = p?.action
    if (!action || !CARD_ACTIONS.has(action.type)) return null

    const card = action.data?.card
    const list = action.data?.list
    if (!card?.id || !card?.name) return null

    const config = JSON.parse(source.config_json || '{}')
    if (config.listId && list?.id !== config.listId) return null

    const descParts: string[] = []
    if (card.desc) descParts.push(card.desc)
    if (card.shortUrl) descParts.push(`\n**Trello:** ${card.shortUrl}`)

    return {
      title: card.name,
      description: descParts.join('\n') || card.name,
      externalId: card.id,
      externalUrl: card.shortUrl || undefined,
    }
  },
}
