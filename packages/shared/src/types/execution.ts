export type ExecutionStatus = 'planning' | 'approving' | 'executing' | 'done' | 'failed'
export type ExecutionTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'paused'
export type GapStatus = 'pending' | 'resolved'

export interface Execution {
  id: string
  cardId: string | null
  specId: string | null
  status: ExecutionStatus
  createdAt: string
  updatedAt: string
}

export interface ExecutionTask {
  id: string
  executionId: string
  title: string
  description: string | null
  branch: string | null
  status: ExecutionTaskStatus
  agentId: string | null
  dependsOn: string | null
  prUrl: string | null
  createdAt: string
}

export interface ExecutionGap {
  id: string
  executionId: string
  question: string
  suggestion: string | null
  response: string | null
  status: GapStatus
}

export interface ExecutionLog {
  id: string
  executionTaskId: string
  content: string
  type: 'stdout' | 'stderr' | 'approval_request'
  createdAt: string
}
