import { create } from 'zustand'
import type { AgentMemoryEntry, MemoryStats, MemoryType } from '@gaud/shared'
import { api } from '@/api/client'

interface MemoryState {
  memories: AgentMemoryEntry[]
  searchResults: Array<AgentMemoryEntry & { similarity: number }>
  stats: MemoryStats | null
  loading: boolean
  error: string | null
  filterType: MemoryType | null

  loadMemories: (agentId: string) => Promise<void>
  search: (agentId: string, query: string) => Promise<void>
  storeMemory: (agentId: string, data: { type: string; content: string; tags?: string[] }) => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  loadStats: () => Promise<void>
  setFilterType: (type: MemoryType | null) => void
  clearSearch: () => void
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  searchResults: [],
  stats: null,
  loading: false,
  error: null,
  filterType: null,

  loadMemories: async (agentId) => {
    set({ loading: true, error: null })
    try {
      const type = get().filterType
      const memories = await api.memory.listForAgent(agentId, { type: type ?? undefined })
      set({ memories, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  search: async (agentId, query) => {
    set({ loading: true, error: null })
    try {
      const searchResults = await api.memory.search(agentId, query)
      set({ searchResults, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  storeMemory: async (agentId, data) => {
    set({ loading: true, error: null })
    try {
      await api.memory.store(agentId, data)
      await get().loadMemories(agentId)
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  deleteMemory: async (id) => {
    try {
      await api.memory.delete(id)
      set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadStats: async () => {
    try {
      const stats = await api.memory.stats()
      set({ stats })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  setFilterType: (type) => set({ filterType: type }),
  clearSearch: () => set({ searchResults: [] }),
}))
