import type { Agent, AgentWithChildren, Skill, ProviderConfig, Board, BoardWithColumns, Card, CardWithDetails, CardComment, CardRepo, CardDependency } from '@gaud/shared'

const API_BASE = '/api'

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  health: () => request<{ status: string; timestamp: string }>('/health'),

  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<AgentWithChildren>(`/agents/${id}`),
    create: (data: Partial<Agent>) => request<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Agent>) => request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),
    assignSkill: (id: string, skillId: string) => request<void>(`/agents/${id}/skills`, { method: 'POST', body: JSON.stringify({ skillId }) }),
    removeSkill: (id: string, skillId: string) => request<void>(`/agents/${id}/skills/${skillId}`, { method: 'DELETE' }),
    getCost: (id: string) => request<{ totalCostUsd: number; totalTokensIn: number; totalTokensOut: number; limitUsd: number; isOverLimit: boolean }>(`/agents/${id}/cost`),
  },

  skills: {
    list: () => request<Skill[]>('/skills'),
    get: (id: string) => request<Skill>(`/skills/${id}`),
    create: (data: { name: string; description?: string; content: string }) => request<Skill>('/skills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; description?: string; content: string }) => request<Skill>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/skills/${id}`, { method: 'DELETE' }),
  },

  providers: {
    list: () => request<ProviderConfig[]>('/providers'),
    get: (id: string) => request<ProviderConfig>(`/providers/${id}`),
    create: (data: { name: string; type: string; configJson: Record<string, unknown> }) => request<ProviderConfig>('/providers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; type: string; configJson: Record<string, unknown> }) => request<ProviderConfig>(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/providers/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<{ success: boolean; message: string }>(`/providers/${id}/test`, { method: 'POST' }),
  },

  boards: {
    list: () => request<Board[]>('/boards'),
    get: (id: string) => request<BoardWithColumns>(`/boards/${id}`),
    create: (data: { name: string }) => request<Board>('/boards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string }) => request<Board>(`/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/boards/${id}`, { method: 'DELETE' }),
    createColumn: (boardId: string, data: any) => request(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify(data) }),
    updateColumn: (colId: string, data: any) => request(`/columns/${colId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteColumn: (colId: string) => request<void>(`/columns/${colId}`, { method: 'DELETE' }),
    reorderColumns: (boardId: string, columnIds: string[]) => request(`/boards/${boardId}/columns/reorder`, { method: 'PUT', body: JSON.stringify({ columnIds }) }),
    gantt: (boardId: string) => request<{ cards: Card[]; dependencies: CardDependency[]; columns: any[] }>(`/boards/${boardId}/gantt`),
  },

  cards: {
    list: (boardId: string) => request<Card[]>(`/boards/${boardId}/cards`),
    get: (id: string) => request<CardWithDetails>(`/cards/${id}`),
    create: (data: any) => request<Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<Card>(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/cards/${id}`, { method: 'DELETE' }),
    move: (id: string, data: { columnId: string; position: number }) => request<Card>(`/cards/${id}/move`, { method: 'PUT', body: JSON.stringify(data) }),
    addComment: (id: string, data: { authorType: string; content: string }) => request<CardComment>(`/cards/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    addRepo: (id: string, data: { repoPath: string; specPath?: string }) => request<CardRepo>(`/cards/${id}/repos`, { method: 'POST', body: JSON.stringify(data) }),
    removeRepo: (id: string, repoId: string) => request<void>(`/cards/${id}/repos/${repoId}`, { method: 'DELETE' }),
    addDependency: (id: string, dependsOnCardId: string) => request(`/cards/${id}/dependencies`, { method: 'POST', body: JSON.stringify({ dependsOnCardId }) }),
    removeDependency: (id: string, depId: string) => request<void>(`/cards/${id}/dependencies/${depId}`, { method: 'DELETE' }),
  },
}
