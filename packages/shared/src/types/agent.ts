import type { Skill } from './skill.js'

export interface Agent {
  id: string
  name: string
  role: string | null
  instructions: string | null
  providerId: string | null
  model: string | null
  costLimitUsd: number
  parentAgentId: string | null
  requiresParentApproval: boolean
  escalationTimeoutMinutes: number
  createdAt: string
}

export type AgentReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface AgentReview {
  id: string
  executionTaskId: string | null
  conversationId: string | null
  reviewerAgentId: string
  revieweeAgentId: string
  status: AgentReviewStatus
  comment: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface AgentCostLog {
  id: string
  agentId: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  providerId: string | null
  model: string | null
  taskId: string | null
  createdAt: string
}

export interface AgentWithChildren extends Agent {
  children: AgentWithChildren[]
  skills: Skill[]
}
