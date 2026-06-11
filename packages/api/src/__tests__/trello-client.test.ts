import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TrelloClient } from '../services/trello-client.js'

describe('TrelloClient', () => {
  let client: TrelloClient
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new TrelloClient('test-key', 'test-token')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockResponse(body: unknown, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  }

  describe('validateCredentials', () => {
    it('returns true on 200', async () => {
      fetchMock.mockReturnValue(mockResponse({ id: 'member1', username: 'felipe' }))
      const result = await client.validateCredentials()
      expect(result).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/members/me?key=test-key&token=test-token')
      )
    })

    it('returns false on 401', async () => {
      fetchMock.mockReturnValue(mockResponse({}, 401))
      const result = await client.validateCredentials()
      expect(result).toBe(false)
    })
  })

  describe('getBoard', () => {
    it('returns board info', async () => {
      fetchMock.mockReturnValue(mockResponse({ id: 'board1', name: 'My Board' }))
      const board = await client.getBoard('board1')
      expect(board).toEqual({ id: 'board1', name: 'My Board' })
    })
  })

  describe('getLists', () => {
    it('returns lists for a board', async () => {
      const lists = [
        { id: 'list1', name: 'To Do' },
        { id: 'list2', name: 'Doing' },
      ]
      fetchMock.mockReturnValue(mockResponse(lists))
      const result = await client.getLists('board1')
      expect(result).toEqual(lists)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/boards/board1/lists')
      )
    })
  })

  describe('getCards', () => {
    it('returns open cards for a board', async () => {
      const cards = [
        { id: 'c1', idList: 'list1', name: 'Fix bug', desc: 'Details', shortUrl: 'https://trello.com/c/abc', closed: false },
        { id: 'c2', idList: 'list2', name: 'Add feature', desc: '', shortUrl: 'https://trello.com/c/def', closed: false },
      ]
      fetchMock.mockReturnValue(mockResponse(cards))
      const result = await client.getCards('board1')
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Fix bug')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/boards/board1/cards')
      )
    })
  })

  describe('getChecklists', () => {
    it('returns checklists with items for a card', async () => {
      const checklists = [
        {
          id: 'cl1',
          name: 'Steps',
          checkItems: [
            { id: 'ci1', name: 'Step 1', state: 'complete' },
            { id: 'ci2', name: 'Step 2', state: 'incomplete' },
          ],
        },
      ]
      fetchMock.mockReturnValue(mockResponse(checklists))
      const result = await client.getChecklists('c1')
      expect(result).toHaveLength(1)
      expect(result[0].checkItems).toHaveLength(2)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/cards/c1/checklists')
      )
    })
  })

  describe('getAttachments', () => {
    it('returns attachments for a card', async () => {
      const attachments = [
        { id: 'att1', name: 'Subtask Card', url: 'https://trello.com/c/xyz', isUpload: false },
        { id: 'att2', name: 'screenshot.png', url: 'https://trello.com/1/cards/c1/attachments/att2/download', isUpload: true },
      ]
      fetchMock.mockReturnValue(mockResponse(attachments))
      const result = await client.getAttachments('c1')
      expect(result).toHaveLength(2)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/cards/c1/attachments')
      )
    })
  })

  describe('createWebhook', () => {
    it('creates webhook and returns id', async () => {
      fetchMock.mockReturnValue(mockResponse({ id: 'wh1' }))
      const result = await client.createWebhook('https://example.com/hook', 'board1')
      expect(result).toBe('wh1')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/webhooks'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('deleteWebhook', () => {
    it('deletes webhook by id', async () => {
      fetchMock.mockReturnValue(mockResponse({}))
      await client.deleteWebhook('wh1')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/1/webhooks/wh1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
