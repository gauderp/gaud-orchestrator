export type MemoryType = 'conversation' | 'error_correction' | 'pattern_success' | 'code_knowledge' | 'user_preference'

export interface AgentMemoryEntry {
  id: string
  agentId: string
  type: MemoryType
  content: string
  metadataJson: Record<string, unknown>
  tags: string[]
  relevanceScore: number
  createdAt: string
  updatedAt: string
}

export interface MemorySession {
  id: string
  agentId: string
  conversationId: string | null
  startedAt: string
  endedAt: string | null
  consolidated: boolean
}

export interface MemoryStats {
  totalMemories: number
  byType: Record<MemoryType, number>
  byAgent: Record<string, number>
}
