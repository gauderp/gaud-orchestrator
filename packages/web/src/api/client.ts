import type { Agent, AgentWithChildren, Skill, ProviderConfig, Board, BoardWithColumns, Card, CardWithDetails, CardComment, CardRepo, CardDependency, CardEstimate, AskAgentResponse, CardTag, Conversation, ConversationWithMessages, Message, AgentMemoryEntry, MemoryStats, Spec, SpecReview, SpecRepo, Execution, Repository, BugReport, BugReportWithAttachments, BugSource } from '@gaud/shared'
import { useAuthStore } from '@/store/auth'

const API_BASE = '/api'

// Mutex for token refresh — prevents parallel 401s from triggering multiple refreshes
let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = useAuthStore.getState().refresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

function getAuthHeader(): string | null {
  return useAuthStore.getState().accessToken
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const token = getAuthHeader()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  })

  // On 401, try refresh once and retry
  if (res.status === 401 && token) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const newToken = getAuthHeader()
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
      })
    }
  }

  if (!res.ok) {
    if (res.status === 401) useAuthStore.getState().logout()
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function fetchWithAuth(url: string, init: RequestInit): Promise<Response> {
  const token = getAuthHeader()
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(url, { ...init, headers })

  if (res.status === 401 && token) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      const newToken = getAuthHeader()
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(url, { ...init, headers })
    }
  }
  if (res.status === 401) useAuthStore.getState().logout()
  return res
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
    getTree: () => request<any[]>('/agents/tree'),
    getReviews: (id: string) => request<any[]>(`/agents/${id}/reviews`),
    getAllReviews: (id: string) => request<any[]>(`/agents/${id}/reviews/all`),
    updateHierarchy: (id: string, data: { parentAgentId?: string | null; requiresParentApproval?: boolean; escalationTimeoutMinutes?: number }) =>
      request<any>(`/agents/${id}/hierarchy`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  reviews: {
    resolve: (reviewId: string, data: { status: string; comment?: string }) =>
      request<any>(`/reviews/${reviewId}/resolve`, { method: 'POST', body: JSON.stringify(data) }),
  },

  skills: {
    list: () => request<Skill[]>('/skills'),
    get: (id: string) => request<Skill>(`/skills/${id}`),
    create: (data: { name: string; description?: string; content: string }) => request<Skill>('/skills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; description?: string; content: string }) => request<Skill>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/skills/${id}`, { method: 'DELETE' }),
    importFromGithub: (url: string) => request<{ imported: Array<{ id: string; name: string; action: string }> }>('/skills/import', { method: 'POST', body: JSON.stringify({ url }) }),
    previewImport: (url: string) => request<{ skills: Array<{ name: string; description: string; contentPreview: string; exists: boolean }> }>('/skills/import/preview', { method: 'POST', body: JSON.stringify({ url }) }),
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
    estimate: (id: string) => request<CardEstimate>(`/cards/${id}/estimate`, { method: 'POST' }),
    askAgent: (id: string, data: { agentId: string; prompt: string }) =>
      request<AskAgentResponse>(`/cards/${id}/ask-agent`, { method: 'POST', body: JSON.stringify(data) }),
    addTag: (cardId: string, data: { name: string; color?: string }) =>
      request<CardTag>(`/cards/${cardId}/tags`, { method: 'POST', body: JSON.stringify(data) }),
    removeTag: (cardId: string, tagId: string) =>
      request<void>(`/cards/${cardId}/tags/${tagId}`, { method: 'DELETE' }),
    moveToBoard: (cardId: string, data: { boardId: string; columnId: string }) =>
      request<Card>(`/cards/${cardId}/move-to-board`, { method: 'POST', body: JSON.stringify(data) }),
    sendToDev: (cardId: string) =>
      request(`/cards/${cardId}/send-to-dev`, { method: 'POST' }),
    sendToSpec: (cardId: string) =>
      request(`/cards/${cardId}/send-to-spec`, { method: 'POST' }),
    reopen: (cardId: string, reason?: string) =>
      request(`/cards/${cardId}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
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
  github: {
    auth: () => request<{ authenticated: boolean; user: string | null; orgs: string[] }>('/github/auth'),
    listRemoteRepos: (owner: string) => request<Array<{ name: string; fullName: string; description: string; private: boolean }>>(`/github/repos/${owner}`),
  },

  repositories: {
    list: () => request<Repository[]>('/repositories'),
    add: (githubUrl: string, defaultBranch?: string) => request<Repository>('/repositories', { method: 'POST', body: JSON.stringify({ githubUrl, defaultBranch }) }),
    sync: (id: string) => request<Repository>(`/repositories/${id}/sync`, { method: 'POST' }),
    delete: (id: string) => request<void>(`/repositories/${id}`, { method: 'DELETE' }),
    cleanupWorktrees: (id: string) => request<{ cleaned: number }>(`/repositories/${id}/cleanup-worktrees`, { method: 'POST' }),
  },

  bugReports: {
    list: (status?: string) => request<BugReport[]>(`/bug-reports${status ? `?status=${status}` : ''}`),
    get: (id: string) => request<BugReportWithAttachments>(`/bug-reports/${id}`),
    create: (data: FormData) => fetchWithAuth(`${API_BASE}/bug-reports`, { method: 'POST', body: data }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error) })
      return r.json()
    }),
    triage: (id: string, agentId: string) => request(`/bug-reports/${id}/triage`, { method: 'POST', body: JSON.stringify({ agentId }) }),
    respond: (id: string, content: string) => request(`/bug-reports/${id}/respond`, { method: 'POST', body: JSON.stringify({ content }) }),
    delete: (id: string) => request<void>(`/bug-reports/${id}`, { method: 'DELETE' }),
  },

  bugSources: {
    list: () => request<BugSource[]>('/bug-sources'),
    create: (data: { name: string; type: string; configJson?: string }) =>
      request<BugSource>('/bug-sources', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { enabled: boolean }) =>
      request<BugSource>(`/bug-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/bug-sources/${id}`, { method: 'DELETE' }),
  },

  backup: {
    preview: (file: File) => {
      const fd = new FormData(); fd.append('file', file)
      return fetchWithAuth(`${API_BASE}/backup/preview`, { method: 'POST', body: fd })
        .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error) }); return r.json() })
    },
    restore: (file: File) => {
      const fd = new FormData(); fd.append('file', file)
      return fetchWithAuth(`${API_BASE}/backup/restore`, { method: 'POST', body: fd })
        .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error) }); return r.json() })
    },
  },

  executions: {
    list: () => request<Execution[]>('/executions'),
    get: (id: string) => request<Execution>(`/executions/${id}`),
    create: (data: { cardId: string; branch?: string }) => request<Execution>('/executions', { method: 'POST', body: JSON.stringify(data) }),
    complete: (id: string, data: { outcome: string; prUrl?: string }) => request<Execution>(`/executions/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  },

  specs: {
    list: () => request<Spec[]>('/specs'),
    get: (id: string) => request<Spec & { reviews: SpecReview[]; repos: SpecRepo[] }>(`/specs/${id}`),
    create: (data: { title: string; content: string; createdByType?: string }) =>
      request<Spec>('/specs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; content?: string }) =>
      request<Spec>(`/specs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    review: (id: string, data: { reviewerType: string; verdict: string; comment?: string }) =>
      request<SpecReview>(`/specs/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
    generate: (data: { title: string; description: string; repos?: string[]; agentIds: string[]; cardId?: string }) =>
      request<{ spec: Spec; conversationId: string }>('/specs/generate', { method: 'POST', body: JSON.stringify(data) }),
    decompose: (id: string, data: { boardId: string; columnId: string }) =>
      request<{ specId: string; boardId: string; cards: any[] }>(`/specs/${id}/decompose`, { method: 'POST', body: JSON.stringify(data) }),
    listRepos: (specId: string) => request<SpecRepo[]>(`/specs/${specId}/repos`),
    addRepo: (specId: string, data: { repoPath: string; repositoryId?: string }) =>
      request<SpecRepo>(`/specs/${specId}/repos`, { method: 'POST', body: JSON.stringify(data) }),
    removeRepo: (specId: string, repoId: string) => request<void>(`/specs/${specId}/repos/${repoId}`, { method: 'DELETE' }),
  },
}
