import { create } from 'zustand'
import type { Spec, SpecReview } from '@gaud/shared'
import { api } from '../api/client.js'

interface SpecState {
  specs: Spec[]
  selectedSpec: (Spec & { reviews: SpecReview[] }) | null
  loading: boolean
  statusFilter: string | null

  fetchSpecs: (status?: string) => Promise<void>
  fetchSpec: (id: string) => Promise<void>
  createSpec: (data: { title: string; content: string; sourceCardId?: string }) => Promise<Spec>
  updateSpec: (id: string, data: { title?: string; content?: string }) => Promise<void>
  reviewSpec: (id: string, data: { reviewerType: string; verdict: string; comment?: string }) => Promise<void>
  generateSpec: (data: { title: string; description: string; repos?: string[]; agentIds: string[]; cardId?: string }) => Promise<{ spec: Spec; conversationId: string }>
  decomposeSpec: (id: string, data: { boardId: string; columnId: string }) => Promise<any>
  setStatusFilter: (status: string | null) => void

  onSpecUpdated: (spec: Spec) => void
}

export const useSpecStore = create<SpecState>((set, get) => ({
  specs: [],
  selectedSpec: null,
  loading: false,
  statusFilter: null,

  fetchSpecs: async (status) => {
    set({ loading: true })
    const specs = await api.specs.list(status ?? get().statusFilter ?? undefined)
    set({ specs, loading: false })
  },

  fetchSpec: async (id) => {
    const spec = await api.specs.get(id)
    set({ selectedSpec: spec })
  },

  createSpec: async (data) => {
    const spec = await api.specs.create(data)
    set((s) => ({ specs: [spec, ...s.specs] }))
    return spec
  },

  updateSpec: async (id, data) => {
    const spec = await api.specs.update(id, data)
    set((s) => ({
      specs: s.specs.map((sp) => (sp.id === id ? spec : sp)),
      selectedSpec: s.selectedSpec?.id === id ? { ...s.selectedSpec, ...spec } : s.selectedSpec,
    }))
  },

  reviewSpec: async (id, data) => {
    await api.specs.review(id, data)
    // Refresh spec to get updated status and reviews
    await get().fetchSpec(id)
    await get().fetchSpecs()
  },

  generateSpec: async (data) => {
    const result = await api.specs.generate(data)
    set((s) => ({ specs: [result.spec, ...s.specs] }))
    return result
  },

  decomposeSpec: async (id, data) => {
    return api.specs.decompose(id, data)
  },

  setStatusFilter: (status) => set({ statusFilter: status }),

  onSpecUpdated: (spec) => {
    set((s) => ({
      specs: s.specs.map((sp) => (sp.id === spec.id ? { ...sp, ...spec } : sp)),
      selectedSpec: s.selectedSpec?.id === spec.id ? { ...s.selectedSpec, ...spec } : s.selectedSpec,
    }))
  },
}))
