export type ExecutionOutcome = 'success' | 'failed'

export interface Execution {
  id: string
  cardId: string
  startedAt: string
  finishedAt: string | null
  outcome: ExecutionOutcome | null
  prUrl: string | null
  branch: string | null
}
