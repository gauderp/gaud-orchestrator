import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from './helpers/test-db.js'
import { TrelloImportService } from '../services/trello-import.js'
import type Database from 'better-sqlite3'
import { BOARD_IDS, DEV_COLUMNS, TRIAGE_COLUMNS } from '@gaud/shared'

function makeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    name: 'Test Trello',
    target: 'dev' as const,
    trello_board_id: 'tb-1',
    api_key: 'k',
    api_token: 't',
    api_secret: null,
    config_json: JSON.stringify({ listMapping: { 'tlist-todo': DEV_COLUMNS.TODO, 'tlist-doing': DEV_COLUMNS.IN_PROGRESS } }),
    webhook_secret: 'ws',
    trello_webhook_id: null,
    enabled: 1,
    last_backfill_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeBugsIntegration(overrides: Record<string, unknown> = {}) {
  return makeIntegration({
    id: 'int-bugs',
    target: 'bugs',
    config_json: JSON.stringify({ captureListIds: ['tlist-bugs'] }),
    ...overrides,
  })
}

describe('TrelloImportService', () => {
  let db: Database.Database
  let service: TrelloImportService

  beforeEach(() => {
    db = createTestDb()
    // Insert the integration row so FK is satisfied
    db.prepare(`INSERT INTO trello_integrations (id, name, target, trello_board_id, api_key, api_token, config_json, webhook_secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'int-1', 'Test', 'dev', 'tb-1', 'k', 't', JSON.stringify({ listMapping: { 'tlist-todo': DEV_COLUMNS.TODO, 'tlist-doing': DEV_COLUMNS.IN_PROGRESS } }), 'ws'
    )
    db.prepare(`INSERT INTO trello_integrations (id, name, target, trello_board_id, api_key, api_token, config_json, webhook_secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'int-bugs', 'Bugs', 'bugs', 'tb-2', 'k', 't', JSON.stringify({ captureListIds: ['tlist-bugs'] }), 'ws2'
    )
    service = new TrelloImportService(db)
  })

  describe('importCard target dev', () => {
    it('creates card in mapped column', () => {
      const integration = makeIntegration()
      const result = service.importCard(integration, {
        id: 'tc-1', idList: 'tlist-todo', name: 'Fix bug', desc: 'Details', shortUrl: 'https://trello.com/c/abc', closed: false,
      })
      expect(result).toBe('created')

      const card = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-1') as any
      expect(card).toBeDefined()
      expect(card.column_id).toBe(DEV_COLUMNS.TODO)
      expect(card.title).toBe('Fix bug')
      expect(card.integration_id).toBe('int-1')
      expect(card.external_url).toBe('https://trello.com/c/abc')
      expect(card.type).toBe('task')
      expect(card.board_id).toBe(BOARD_IDS.DEV)
    })

    it('updates existing card on second import (dedup)', () => {
      const integration = makeIntegration()
      service.importCard(integration, {
        id: 'tc-1', idList: 'tlist-todo', name: 'Fix bug', desc: 'V1', shortUrl: 'https://trello.com/c/abc', closed: false,
      })
      const result = service.importCard(integration, {
        id: 'tc-1', idList: 'tlist-todo', name: 'Fix bug v2', desc: 'V2', shortUrl: 'https://trello.com/c/abc', closed: false,
      })
      expect(result).toBe('updated')

      const cards = db.prepare('SELECT * FROM cards WHERE integration_id = ?').all('int-1')
      expect(cards).toHaveLength(1)
      expect((cards[0] as any).title).toBe('Fix bug v2')
    })

    it('ignores card from unmapped list', () => {
      const integration = makeIntegration()
      const result = service.importCard(integration, {
        id: 'tc-x', idList: 'tlist-other', name: 'Ignore me', desc: '', shortUrl: '', closed: false,
      })
      expect(result).toBe('ignored')
    })
  })

  describe('importCard target bugs', () => {
    it('creates bug_report + card in Triage New', () => {
      const integration = makeBugsIntegration()
      const result = service.importCard(integration, {
        id: 'tc-bug1', idList: 'tlist-bugs', name: 'Crash on login', desc: 'Steps to reproduce', shortUrl: 'https://trello.com/c/bug1', closed: false,
      })
      expect(result).toBe('created')

      const card = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-bug1') as any
      expect(card).toBeDefined()
      expect(card.board_id).toBe(BOARD_IDS.TRIAGE)
      expect(card.column_id).toBe(TRIAGE_COLUMNS.NEW)
      expect(card.type).toBe('bug')
      expect(card.integration_id).toBe('int-bugs')

      const bugReport = db.prepare('SELECT * FROM bug_reports WHERE card_id = ?').get(card.id) as any
      expect(bugReport).toBeDefined()
      expect(bugReport.title).toBe('Crash on login')
      expect(bugReport.source).toBe('trello')
      expect(bugReport.source_id).toBeNull()
      expect(bugReport.external_id).toBe('tc-bug1')
      expect(bugReport.external_url).toBe('https://trello.com/c/bug1')
    })

    it('ignores card from non-capture list', () => {
      const integration = makeBugsIntegration()
      const result = service.importCard(integration, {
        id: 'tc-x', idList: 'tlist-other', name: 'Not a bug', desc: '', shortUrl: '', closed: false,
      })
      expect(result).toBe('ignored')
    })
  })

  describe('handleWebhookEvent', () => {
    it('creates card on createCard action in mapped list', () => {
      const integration = makeIntegration()
      const result = service.handleWebhookEvent(integration, {
        action: {
          type: 'createCard',
          data: {
            card: { id: 'tc-2', name: 'New task', desc: 'Do it', shortUrl: 'https://trello.com/c/xyz', closed: false },
            list: { id: 'tlist-todo', name: 'To Do' },
          },
        },
      })
      expect(result).toBe('created')
    })

    it('ignores createCard on unmapped list', () => {
      const integration = makeIntegration()
      const result = service.handleWebhookEvent(integration, {
        action: {
          type: 'createCard',
          data: {
            card: { id: 'tc-3', name: 'Skip', desc: '', shortUrl: '', closed: false },
            list: { id: 'tlist-other', name: 'Other' },
          },
        },
      })
      expect(result).toBe('ignored')
    })

    it('moves card on updateCard with listAfter + adds comment', () => {
      const integration = makeIntegration()
      // First create the card
      service.importCard(integration, {
        id: 'tc-m1', idList: 'tlist-todo', name: 'Task M', desc: '', shortUrl: '', closed: false,
      })

      const result = service.handleWebhookEvent(integration, {
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'tc-m1', name: 'Task M', shortUrl: '' },
            listBefore: { id: 'tlist-todo', name: 'To Do' },
            listAfter: { id: 'tlist-doing', name: 'Doing' },
          },
        },
      })
      expect(result).toBe('updated')

      const card = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-m1') as any
      expect(card.column_id).toBe(DEV_COLUMNS.IN_PROGRESS)

      const comment = db.prepare('SELECT * FROM card_comments WHERE card_id = ?').get(card.id) as any
      expect(comment).toBeDefined()
      expect(comment.content).toContain('To Do')
      expect(comment.content).toContain('Doing')
      expect(comment.author_type).toBe('system')
    })

    it('updates title/desc on updateCard rename', () => {
      const integration = makeIntegration()
      service.importCard(integration, {
        id: 'tc-r1', idList: 'tlist-todo', name: 'Old name', desc: 'Old desc', shortUrl: '', closed: false,
      })

      service.handleWebhookEvent(integration, {
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'tc-r1', name: 'New name', desc: 'New desc', shortUrl: '' },
            old: { name: 'Old name', desc: 'Old desc' },
          },
        },
      })

      const card = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-r1') as any
      expect(card.title).toBe('New name')
      expect(card.description).toBe('New desc')
    })

    it('adds comment on card archived (closed=true)', () => {
      const integration = makeIntegration()
      service.importCard(integration, {
        id: 'tc-a1', idList: 'tlist-todo', name: 'Archive me', desc: '', shortUrl: '', closed: false,
      })

      service.handleWebhookEvent(integration, {
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'tc-a1', name: 'Archive me', closed: true, shortUrl: '' },
            old: { closed: false },
          },
        },
      })

      const card = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-a1') as any
      expect(card).toBeDefined() // card still exists

      const comment = db.prepare('SELECT * FROM card_comments WHERE card_id = ?').get(card.id) as any
      expect(comment.content).toContain('Archived on Trello')
    })

    it('ignores unhandled action types', () => {
      const integration = makeIntegration()
      const result = service.handleWebhookEvent(integration, {
        action: { type: 'addMemberToBoard', data: {} },
      })
      expect(result).toBe('ignored')
    })
  })

  describe('importChecklists', () => {
    it('creates child cards from checklist items', () => {
      const integration = makeIntegration()
      // Create parent card first
      service.importCard(integration, {
        id: 'tc-parent', idList: 'tlist-todo', name: 'Parent', desc: '', shortUrl: '', closed: false,
      })
      const parentCard = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-parent') as any

      const checklists = [
        {
          id: 'cl1', name: 'Checklist A',
          checkItems: [
            { id: 'ci1', name: 'Step 1', state: 'complete' as const },
            { id: 'ci2', name: 'Step 2', state: 'incomplete' as const },
          ],
        },
        {
          id: 'cl2', name: 'Checklist B',
          checkItems: [
            { id: 'ci3', name: 'Step 3', state: 'incomplete' as const },
          ],
        },
      ]

      const result = service.importChecklists(integration, parentCard.id, checklists)
      expect(result.created).toBe(3)

      const children = db.prepare('SELECT * FROM cards WHERE parent_card_id = ? ORDER BY position').all(parentCard.id) as any[]
      expect(children).toHaveLength(3)
      expect(children[0].title).toBe('Step 1')
      expect(children[0].external_id).toBe('checklist:ci1')
      // Complete item goes to last column (Done)
      expect(children[0].column_id).toBe(DEV_COLUMNS.DONE)
      // Incomplete items stay in parent column
      expect(children[1].column_id).toBe(DEV_COLUMNS.TODO)
      expect(children[2].title).toBe('Step 3')
    })

    it('does not duplicate on second run (dedup)', () => {
      const integration = makeIntegration()
      service.importCard(integration, {
        id: 'tc-p2', idList: 'tlist-todo', name: 'Parent 2', desc: '', shortUrl: '', closed: false,
      })
      const parentCard = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-p2') as any

      const checklists = [{
        id: 'cl-x', name: 'CL',
        checkItems: [{ id: 'ci-x1', name: 'Item', state: 'incomplete' as const }],
      }]

      service.importChecklists(integration, parentCard.id, checklists)
      const result2 = service.importChecklists(integration, parentCard.id, checklists)
      expect(result2.created).toBe(0)
      expect(result2.updated).toBe(1)

      const children = db.prepare('SELECT * FROM cards WHERE parent_card_id = ?').all(parentCard.id)
      expect(children).toHaveLength(1)
    })
  })

  describe('linkSubtasks (power-up)', () => {
    it('links child card via attachment URL', () => {
      const integration = makeIntegration()
      // Import parent and child cards
      service.importCard(integration, {
        id: 'tc-parent-s', idList: 'tlist-todo', name: 'Parent Story', desc: '', shortUrl: 'https://trello.com/c/parent', closed: false,
      })
      service.importCard(integration, {
        id: 'tc-child-s', idList: 'tlist-doing', name: 'Child Task', desc: '', shortUrl: 'https://trello.com/c/childShort', closed: false,
      })

      const parentCard = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-parent-s') as any
      const childCard = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-child-s') as any
      expect(childCard.parent_card_id).toBeNull()

      const attachments = [
        { id: 'att1', name: 'Child Task', url: 'https://trello.com/c/childShort', isUpload: false },
        { id: 'att2', name: 'screenshot.png', url: 'https://cdn.trello.com/file.png', isUpload: true },
      ]

      const linked = service.linkSubtasks(integration, parentCard.id, attachments)
      expect(linked).toBe(1)

      const updated = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-child-s') as any
      expect(updated.parent_card_id).toBe(parentCard.id)
    })

    it('ignores attachment pointing to card from different integration', () => {
      const integration = makeIntegration()
      service.importCard(integration, {
        id: 'tc-p-other', idList: 'tlist-todo', name: 'Parent', desc: '', shortUrl: 'https://trello.com/c/p1', closed: false,
      })
      const parentCard = db.prepare('SELECT * FROM cards WHERE external_id = ?').get('tc-p-other') as any

      // This URL points to a card that doesn't exist in our DB
      const attachments = [
        { id: 'att-x', name: 'Unknown', url: 'https://trello.com/c/unknownCard', isUpload: false },
      ]

      const linked = service.linkSubtasks(integration, parentCard.id, attachments)
      expect(linked).toBe(0)
    })
  })
})
