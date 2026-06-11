export type TrelloTarget = 'bugs' | 'dev'

export interface TrelloIntegration {
  id: string
  name: string
  target: TrelloTarget
  trelloBoardId: string
  apiKey: string
  apiToken: string
  apiSecret: string | null
  configJson: string
  webhookSecret: string
  trelloWebhookId: string | null
  enabled: boolean
  lastBackfillAt: string | null
  createdAt: string
}

export interface TrelloList {
  id: string
  name: string
}
