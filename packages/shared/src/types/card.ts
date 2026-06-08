export type CardType = 'project' | 'epic' | 'task' | 'bug'

export interface Card {
  id: string
  boardId: string
  columnId: string
  parentCardId: string | null
  type: CardType
  title: string
  description: string | null
  assignedAgentId: string | null
  estimatedTokens: number | null
  estimatedCostUsd: number | null
  position: number
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CardDependency {
  cardId: string
  dependsOnCardId: string
}

export interface CardWithDetails extends Card {
  repos: CardRepo[]
  comments: CardComment[]
  attachments: CardAttachment[]
  children: Card[]
  dependencies: CardDependency[]
  tags: CardTag[]
}

export interface CardRepo {
  id: string
  cardId: string
  repoPath: string
  specPath: string | null
}

export interface CardComment {
  id: string
  cardId: string
  authorType: 'user' | 'agent'
  authorId: string | null
  content: string
  createdAt: string
}

export interface CardAttachment {
  id: string
  cardId: string
  filename: string
  path: string
  createdAt: string
}

export interface CardTag {
  id: string
  cardId: string
  name: string
  color: string
  createdAt: string
}

export interface CardEstimate {
  estimatedTokens: number
  estimatedCostUsd: number
  details: string
}

export interface AskAgentResponse {
  conversationId: string
  cardId: string
  agentId: string
}
