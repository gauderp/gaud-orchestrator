const BASE_URL = 'https://api.trello.com/1'

export interface TrelloCardRaw {
  id: string
  idList: string
  name: string
  desc: string
  shortUrl: string
  closed: boolean
}

export interface TrelloChecklist {
  id: string
  name: string
  checkItems: TrelloCheckItem[]
}

export interface TrelloCheckItem {
  id: string
  name: string
  state: 'complete' | 'incomplete'
}

export interface TrelloAttachment {
  id: string
  name: string
  url: string
  isUpload: boolean
}

export class TrelloClient {
  constructor(private apiKey: string, private apiToken: string) {}

  private url(path: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams({ key: this.apiKey, token: this.apiToken, ...params })
    return `${BASE_URL}${path}?${query.toString()}`
  }

  async validateCredentials(): Promise<boolean> {
    const res = await fetch(this.url('/members/me'))
    return res.ok
  }

  async getBoard(boardId: string): Promise<{ id: string; name: string }> {
    const res = await fetch(this.url(`/boards/${boardId}`))
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    return res.json() as Promise<{ id: string; name: string }>
  }

  async getLists(boardId: string): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(this.url(`/boards/${boardId}/lists`))
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    return res.json() as Promise<Array<{ id: string; name: string }>>
  }

  async getCards(boardId: string): Promise<TrelloCardRaw[]> {
    const res = await fetch(this.url(`/boards/${boardId}/cards`, { filter: 'open' }))
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    return res.json() as Promise<TrelloCardRaw[]>
  }

  async getChecklists(cardId: string): Promise<TrelloChecklist[]> {
    const res = await fetch(this.url(`/cards/${cardId}/checklists`))
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    return res.json() as Promise<TrelloChecklist[]>
  }

  async getAttachments(cardId: string): Promise<TrelloAttachment[]> {
    const res = await fetch(this.url(`/cards/${cardId}/attachments`))
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    return res.json() as Promise<TrelloAttachment[]>
  }

  async createWebhook(callbackURL: string, idModel: string): Promise<string> {
    const res = await fetch(this.url('/webhooks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackURL, idModel }),
    })
    if (!res.ok) throw new Error(`Trello API error: ${res.status}`)
    const data = await res.json() as { id: string }
    return data.id
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const res = await fetch(this.url(`/webhooks/${webhookId}`), {
      method: 'DELETE',
    })
    if (!res.ok && res.status !== 404) throw new Error(`Trello API error: ${res.status}`)
  }
}
