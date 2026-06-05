import type { Agent, AgentWithChildren, Skill, ProviderConfig } from '@gaud/shared'

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
}
