export type ConversationType = 'spec' | 'plan' | 'code' | 'research' | 'review'
export type ConversationStatus = 'active' | 'paused_for_user' | 'completed'
export type MessageType = 'content' | 'question_for_agent' | 'question_for_user' | 'artifact'

export interface Conversation {
  id: string
  cardId: string | null
  type: ConversationType
  status: ConversationStatus
  summary: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationParticipant {
  conversationId: string
  agentId: string
  agentName?: string // populated by JOIN on GET /api/conversations/:id
  joinedAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderType: 'agent' | 'user' | 'system'
  senderId: string | null
  content: string
  messageType: MessageType
  mentions: string | null
  createdAt: string
}

export interface ConversationWithMessages extends Conversation {
  participants: ConversationParticipant[]
  messages: Message[]
}
