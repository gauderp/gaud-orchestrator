import type { Agent, AgentWithChildren, Skill, ProviderConfig, Board, BoardWithColumns, Card, CardWithDetails, CardComment, CardRepo, CardDependency, Conversation, ConversationWithMessages, Message, AgentMemoryEntry, MemoryStats, Spec, SpecReview, Execution, ExecutionTask, ExecutionGap, ExecutionLog } from '@gaud/shared'

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

  dashboard: () => request<{
    health: { status: string; wsClients: number }
    agents: { total: number; configured: number }
    cards: { total: number; byType: Record<string, number> }
    specs: { total: number; draft: number; review: number; approved: number; pending: number }
    executions: { total: number; active: number; done: number; failed: number }
    cost: { totalThisMonth: number; tokensIn: number; tokensOut: number }
    conversations: { active: number; pausedForUser: number }
    memories: { total: number; recentLearnings: number }
    skills: { total: number }
    boards: { total: number }
  }>('/dashboard'),

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

  conversations: {
    listForCard: (cardId: string) => request<Conversation[]>(`/cards/${cardId}/conversations`),
    get: (id: string) => request<ConversationWithMessages>(`/conversations/${id}`),
    create: (data: { cardId?: string; type: string; agentIds: string[] }) => request<ConversationWithMessages>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
    getMessages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),
    sendMessage: (id: string, content: string) => request<Message>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
    addAgent: (id: string, agentId: string) => request(`/conversations/${id}/add-agent`, { method: 'POST', body: JSON.stringify({ agentId }) }),
    nextTurn: (id: string) => request(`/conversations/${id}/next-turn`, { method: 'POST' }),
    pause: (id: string) => request<Conversation>(`/conversations/${id}/pause`, { method: 'POST' }),
    resume: (id: string) => request<Conversation>(`/conversations/${id}/resume`, { method: 'POST' }),
  },

  memory: {
    listForAgent: (agentId: string, opts?: { type?: string; limit?: number }) => {
      const params = new URLSearchParams()
      if (opts?.type) params.set('type', opts.type)
      if (opts?.limit) params.set('limit', String(opts.limit))
      const qs = params.toString()
      return request<AgentMemoryEntry[]>(`/agents/${agentId}/memories${qs ? `?${qs}` : ''}`)
    },
    search: (agentId: string, query: string, limit = 5) =>
      request<Array<AgentMemoryEntry & { similarity: number }>>(
        `/agents/${agentId}/memories/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      ),
    store: (agentId: string, data: { type: string; content: string; metadata?: Record<string, unknown>; tags?: string[] }) =>
      request<AgentMemoryEntry>(`/agents/${agentId}/memories`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/memories/${id}`, { method: 'DELETE' }),
    stats: () => request<MemoryStats>('/memory/stats'),
  },
  executions: {
    list: () => request<Execution[]>('/executions'),
    get: (id: string) => request<Execution & { tasks: (ExecutionTask & { logs: ExecutionLog[] })[]; gaps: ExecutionGap[] }>(`/executions/${id}`),
    create: (data: { cardId?: string; specId?: string }) => request<Execution>('/executions', { method: 'POST', body: JSON.stringify(data) }),
    execute: (id: string) => request<Execution>(`/executions/${id}/execute`, { method: 'POST' }),
    cancel: (id: string) => request<Execution>(`/executions/${id}/cancel`, { method: 'POST' }),
    resolveGap: (execId: string, gapId: string, response: string) =>
      request<Execution>(`/executions/${execId}/gaps/${gapId}/resolve`, { method: 'POST', body: JSON.stringify({ response }) }),
  },

  specs: {
    list: (status?: string) => request<Spec[]>(`/specs${status ? `?status=${status}` : ''}`),
    get: (id: string) => request<Spec & { reviews: SpecReview[] }>(`/specs/${id}`),
    create: (data: { title: string; content: string; sourceCardId?: string; createdByType?: string }) =>
      request<Spec>('/specs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; content?: string }) =>
      request<Spec>(`/specs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    review: (id: string, data: { reviewerType: string; verdict: string; comment?: string }) =>
      request<SpecReview>(`/specs/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
    generate: (data: { title: string; description: string; repos?: string[]; agentIds: string[]; cardId?: string }) =>
      request<{ spec: Spec; conversationId: string }>('/specs/generate', { method: 'POST', body: JSON.stringify(data) }),
    decompose: (id: string, data: { boardId: string; columnId: string }) =>
      request<{ specId: string; boardId: string; cards: any[] }>(`/specs/${id}/decompose`, { method: 'POST', body: JSON.stringify(data) }),
  },
}
