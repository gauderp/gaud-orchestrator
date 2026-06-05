import { create } from 'zustand'
import type { ProviderConfig } from '@gaud/shared'
import { api } from '@/api/client'

interface ProviderState {
  providers: ProviderConfig[]
  loading: boolean
  fetchProviders: () => Promise<void>
  createProvider: (data: { name: string; type: string; configJson: Record<string, unknown> }) => Promise<ProviderConfig>
  updateProvider: (id: string, data: { name: string; type: string; configJson: Record<string, unknown> }) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  testProvider: (id: string) => Promise<{ success: boolean; message: string }>
}

export const useProviderStore = create<ProviderState>((set) => ({
  providers: [],
  loading: false,

  fetchProviders: async () => {
    set({ loading: true })
    const providers = await api.providers.list()
    set({ providers, loading: false })
  },

  createProvider: async (data) => {
    const provider = await api.providers.create(data)
    set((s) => ({ providers: [...s.providers, provider] }))
    return provider
  },

  updateProvider: async (id, data) => {
    const provider = await api.providers.update(id, data)
    set((s) => ({ providers: s.providers.map((p) => (p.id === id ? provider : p)) }))
  },

  deleteProvider: async (id) => {
    await api.providers.delete(id)
    set((s) => ({ providers: s.providers.filter((p) => p.id !== id) }))
  },

  testProvider: async (id) => {
    return api.providers.test(id)
  },
}))
