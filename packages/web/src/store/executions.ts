import { create } from 'zustand'
import type { Execution } from '@gaud/shared'
import { api } from '@/api/client'

interface ExecutionState {
  executions: Execution[]
  selectedExecution: Execution | null
  loading: boolean

  fetchExecutions: () => Promise<void>
  fetchExecution: (id: string) => Promise<void>
  createExecution: (data: { cardId: string; branch?: string }) => Promise<Execution>
  completeExecution: (id: string, data: { outcome: string; prUrl?: string }) => Promise<void>

  onExecutionUpdated: (execution: Execution) => void
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: [],
  selectedExecution: null,
  loading: false,

  fetchExecutions: async () => {
    set({ loading: true })
    const executions = await api.executions.list()
    set({ executions, loading: false })
  },

  fetchExecution: async (id) => {
    const execution = await api.executions.get(id)
    set({ selectedExecution: execution })
  },

  createExecution: async (data) => {
    const execution = await api.executions.create(data)
    set((s) => ({ executions: [execution, ...s.executions] }))
    return execution
  },

  completeExecution: async (id, data) => {
    const execution = await api.executions.complete(id, data)
    set((s) => ({
      executions: s.executions.map((e) => (e.id === id ? { ...e, ...execution } : e)),
      selectedExecution: s.selectedExecution?.id === id
        ? { ...s.selectedExecution, ...execution }
        : s.selectedExecution,
    }))
  },

  onExecutionUpdated: (execution) => {
    set((s) => ({
      executions: s.executions.map((e) => (e.id === execution.id ? { ...e, ...execution } : e)),
      selectedExecution: s.selectedExecution?.id === execution.id
        ? { ...s.selectedExecution, ...execution }
        : s.selectedExecution,
    }))
  },
}))
