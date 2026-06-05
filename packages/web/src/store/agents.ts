import { create } from 'zustand'
import type { Agent, AgentWithChildren } from '@gaud/shared'
import { api } from '@/api/client'

interface AgentState {
  agents: Agent[]
  selectedAgent: AgentWithChildren | null
  loading: boolean
  fetchAgents: () => Promise<void>
  fetchAgent: (id: string) => Promise<void>
  createAgent: (data: Partial<Agent>) => Promise<Agent>
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  loading: false,

  fetchAgents: async () => {
    set({ loading: true })
    const agents = await api.agents.list()
    set({ agents, loading: false })
  },

  fetchAgent: async (id) => {
    const agent = await api.agents.get(id)
    set({ selectedAgent: agent })
  },

  createAgent: async (data) => {
    const agent = await api.agents.create(data)
    set((s) => ({ agents: [...s.agents, agent] }))
    return agent
  },

  updateAgent: async (id, data) => {
    const agent = await api.agents.update(id, data)
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? agent : a)),
      selectedAgent: s.selectedAgent?.id === id ? { ...s.selectedAgent, ...agent } : s.selectedAgent,
    }))
  },

  deleteAgent: async (id) => {
    await api.agents.delete(id)
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
      selectedAgent: s.selectedAgent?.id === id ? null : s.selectedAgent,
    }))
  },
}))
