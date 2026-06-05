import { create } from 'zustand'
import type { Execution, ExecutionTask, ExecutionGap, ExecutionLog } from '@gaud/shared'
import { api } from '@/api/client'

type ExecutionWithDetails = Execution & {
  tasks: (ExecutionTask & { logs: ExecutionLog[] })[]
  gaps: ExecutionGap[]
}

interface ExecutionState {
  executions: Execution[]
  selectedExecution: ExecutionWithDetails | null
  loading: boolean

  fetchExecutions: () => Promise<void>
  fetchExecution: (id: string) => Promise<void>
  createExecution: (data: { cardId?: string; specId?: string }) => Promise<Execution>
  executeExecution: (id: string) => Promise<void>
  cancelExecution: (id: string) => Promise<void>
  resolveGap: (execId: string, gapId: string, response: string) => Promise<void>

  onExecutionUpdated: (execution: Execution) => void
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
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

  executeExecution: async (id) => {
    const execution = await api.executions.execute(id)
    set((s) => ({
      executions: s.executions.map((e) => (e.id === id ? { ...e, ...execution } : e)),
      selectedExecution: s.selectedExecution?.id === id
        ? { ...s.selectedExecution, ...execution }
        : s.selectedExecution,
    }))
  },

  cancelExecution: async (id) => {
    const execution = await api.executions.cancel(id)
    set((s) => ({
      executions: s.executions.map((e) => (e.id === id ? { ...e, ...execution } : e)),
      selectedExecution: s.selectedExecution?.id === id
        ? { ...s.selectedExecution, ...execution }
        : s.selectedExecution,
    }))
  },

  resolveGap: async (execId, gapId, response) => {
    await api.executions.resolveGap(execId, gapId, response)
    await get().fetchExecution(execId)
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
