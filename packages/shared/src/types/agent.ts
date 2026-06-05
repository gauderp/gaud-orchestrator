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
  createdAt: string
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
