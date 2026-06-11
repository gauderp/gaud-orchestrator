import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { BOARD_IDS, DEV_COLUMNS, TRIAGE_COLUMNS } from '@gaud/shared'
import type { TrelloCardRaw, TrelloChecklist, TrelloAttachment } from './trello-client.js'

export type ImportResult = 'created' | 'updated' | 'ignored'

interface IntegrationRow {
  id: string
  name: string
  target: 'bugs' | 'dev'
  trello_board_id: string
  api_key: string
  api_token: string
  api_secret: string | null
  config_json: string
  webhook_secret: string
  trello_webhook_id: string | null
  enabled: number
  last_backfill_at: string | null
  created_at: string
}

interface ListMapping {
  listMapping: Record<string, string>
}

interface BugsConfig {
  captureListIds: string[]
}

export class TrelloImportService {
  constructor(private db: Database.Database) {}

  importCard(integration: IntegrationRow, trelloCard: TrelloCardRaw): ImportResult {
    const config = JSON.parse(integration.config_json)

    if (integration.target === 'dev') {
      return this.importDevCard(integration, trelloCard, config as ListMapping)
    } else {
      return this.importBugCard(integration, trelloCard, config as BugsConfig)
    }
  }

  handleWebhookEvent(integration: IntegrationRow, payload: unknown): ImportResult {
    const p = payload as any
    const actionType = p?.action?.type
    const data = p?.action?.data

    if (!actionType || !data) return 'ignored'

    if (actionType === 'createCard') {
      const card = data.card
      const list = data.list
      if (!card || !list) return 'ignored'
      return this.importCard(integration, {
        id: card.id,
        idList: list.id,
        name: card.name,
        desc: card.desc || '',
        shortUrl: card.shortUrl || '',
        closed: card.closed || false,
      })
    }

    if (actionType === 'updateCard') {
      return this.handleUpdateCard(integration, data)
    }

    return 'ignored'
  }

  importChecklists(
    integration: IntegrationRow,
    parentCardId: string,
    checklists: TrelloChecklist[]
  ): { created: number; updated: number } {
    let created = 0
    let updated = 0

    const parentCard = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(parentCardId) as any
    if (!parentCard) return { created, updated }

    // Find the last column of the board for "complete" items
    const lastColumn = this.db.prepare(
      'SELECT id FROM columns WHERE board_id = ? ORDER BY position DESC LIMIT 1'
    ).get(parentCard.board_id) as any

    for (const checklist of checklists) {
      for (const item of checklist.checkItems) {
        const externalId = `checklist:${item.id}`
        const existing = this.db.prepare(
          'SELECT id FROM cards WHERE integration_id = ? AND external_id = ?'
        ).get(integration.id, externalId) as any

        const columnId = item.state === 'complete' && lastColumn
          ? lastColumn.id
          : parentCard.column_id

        if (existing) {
          this.db.prepare(
            "UPDATE cards SET title = ?, column_id = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(item.name, columnId, existing.id)
          updated++
        } else {
          const maxPos = this.db.prepare(
            'SELECT MAX(position) as mp FROM cards WHERE column_id = ?'
          ).get(columnId) as any
          const position = (maxPos?.mp ?? -1) + 1

          this.db.prepare(`
            INSERT INTO cards (id, board_id, column_id, parent_card_id, type, title, integration_id, external_id, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'task', ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(randomUUID(), parentCard.board_id, columnId, parentCardId, item.name, integration.id, externalId, position)
          created++
        }
      }
    }

    return { created, updated }
  }

  linkSubtasks(
    integration: IntegrationRow,
    parentCardId: string,
    attachments: TrelloAttachment[]
  ): number {
    let linked = 0

    for (const att of attachments) {
      // Only care about Trello card attachments (not file uploads)
      if (att.isUpload) continue
      const match = att.url.match(/trello\.com\/c\/([^/]+)/)
      if (!match) continue

      const shortId = match[1]
      // Find card in our DB whose shortUrl ends with this shortId
      const childCard = this.db.prepare(
        "SELECT id, external_url FROM cards WHERE integration_id = ? AND external_url LIKE ? AND parent_card_id IS NULL"
      ).get(integration.id, `%/c/${shortId}%`) as any

      if (childCard) {
        this.db.prepare(
          "UPDATE cards SET parent_card_id = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(parentCardId, childCard.id)
        linked++
      }
    }

    return linked
  }

  // --- Private helpers ---

  private importDevCard(integration: IntegrationRow, trelloCard: TrelloCardRaw, config: ListMapping): ImportResult {
    const columnId = config.listMapping?.[trelloCard.idList]
    if (!columnId) return 'ignored'

    const existing = this.db.prepare(
      'SELECT id FROM cards WHERE integration_id = ? AND external_id = ?'
    ).get(integration.id, trelloCard.id) as any

    if (existing) {
      this.db.prepare(
        "UPDATE cards SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(trelloCard.name, trelloCard.desc || null, existing.id)
      return 'updated'
    }

    const maxPos = this.db.prepare(
      'SELECT MAX(position) as mp FROM cards WHERE column_id = ?'
    ).get(columnId) as any
    const position = (maxPos?.mp ?? -1) + 1

    this.db.prepare(`
      INSERT INTO cards (id, board_id, column_id, type, title, description, integration_id, external_id, external_url, position, created_at, updated_at)
      VALUES (?, ?, ?, 'task', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(randomUUID(), BOARD_IDS.DEV, columnId, trelloCard.name, trelloCard.desc || null, integration.id, trelloCard.id, trelloCard.shortUrl || null, position)

    return 'created'
  }

  private importBugCard(integration: IntegrationRow, trelloCard: TrelloCardRaw, config: BugsConfig): ImportResult {
    if (!config.captureListIds?.includes(trelloCard.idList)) return 'ignored'

    // Dedup via cards table (NOT bug_reports — source_id FK points to bug_sources, not trello_integrations)
    const existing = this.db.prepare(
      'SELECT id FROM cards WHERE integration_id = ? AND external_id = ?'
    ).get(integration.id, trelloCard.id) as any

    if (existing) {
      this.db.prepare(
        "UPDATE cards SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(trelloCard.name, trelloCard.desc || null, existing.id)
      // Also update the bug_report description
      this.db.prepare(
        "UPDATE bug_reports SET description = ?, updated_at = datetime('now') WHERE card_id = ?"
      ).run(trelloCard.desc || null, existing.id)
      return 'updated'
    }

    const cardId = randomUUID()
    const reportId = randomUUID()
    const conversationId = randomUUID()

    // Create conversation for the bug triage flow
    this.db.prepare(
      "INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'research', datetime('now'), datetime('now'))"
    ).run(conversationId)

    // Create card in Triage: New
    const maxPos = this.db.prepare(
      'SELECT MAX(position) as mp FROM cards WHERE column_id = ?'
    ).get(TRIAGE_COLUMNS.NEW) as any
    const position = (maxPos?.mp ?? -1) + 1

    this.db.prepare(`
      INSERT INTO cards (id, board_id, column_id, type, title, description, integration_id, external_id, external_url, position, created_at, updated_at)
      VALUES (?, ?, ?, 'bug', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(cardId, BOARD_IDS.TRIAGE, TRIAGE_COLUMNS.NEW, trelloCard.name, trelloCard.desc || null, integration.id, trelloCard.id, trelloCard.shortUrl || null, position)

    // Create bug_report — source_id = NULL (FK is to bug_sources, not trello_integrations)
    this.db.prepare(`
      INSERT INTO bug_reports (id, title, description, source, source_id, card_id, conversation_id, external_id, external_url, created_at, updated_at)
      VALUES (?, ?, ?, 'trello', NULL, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(reportId, trelloCard.name, trelloCard.desc || null, cardId, conversationId, trelloCard.id, trelloCard.shortUrl || null)

    return 'created'
  }

  private handleUpdateCard(integration: IntegrationRow, data: any): ImportResult {
    const cardData = data.card
    if (!cardData?.id) return 'ignored'

    const existing = this.db.prepare(
      'SELECT * FROM cards WHERE integration_id = ? AND external_id = ?'
    ).get(integration.id, cardData.id) as any
    if (!existing) return 'ignored'

    // Archive event
    if (cardData.closed === true && data.old?.closed === false) {
      this.addComment(existing.id, 'Archived on Trello')
      return 'updated'
    }

    // Move event (listAfter present)
    if (data.listAfter && data.listBefore) {
      const config = JSON.parse(integration.config_json)
      const newColumnId = config.listMapping?.[data.listAfter.id]
      if (newColumnId) {
        const maxPos = this.db.prepare(
          'SELECT MAX(position) as mp FROM cards WHERE column_id = ?'
        ).get(newColumnId) as any
        const position = (maxPos?.mp ?? -1) + 1

        this.db.prepare(
          "UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(newColumnId, position, existing.id)
        this.addComment(existing.id, `Moved on Trello: ${data.listBefore.name} → ${data.listAfter.name}`)
      }
      return 'updated'
    }

    // Rename/description update
    if (data.old?.name !== undefined || data.old?.desc !== undefined) {
      const title = cardData.name || existing.title
      const desc = cardData.desc !== undefined ? (cardData.desc || null) : existing.description
      this.db.prepare(
        "UPDATE cards SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(title, desc, existing.id)
      return 'updated'
    }

    return 'ignored'
  }

  private addComment(cardId: string, content: string): void {
    this.db.prepare(`
      INSERT INTO card_comments (id, card_id, author_type, content, created_at)
      VALUES (?, ?, 'system', ?, datetime('now'))
    `).run(randomUUID(), cardId, content)
  }
}
