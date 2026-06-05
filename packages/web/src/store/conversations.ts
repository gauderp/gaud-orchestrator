import { create } from 'zustand'
import type { Conversation, ConversationWithMessages, Message } from '@gaud/shared'
import { api } from '@/api/client'

interface ConversationState {
  conversations: Conversation[]
  activeConversation: ConversationWithMessages | null
  loading: boolean
  autoRun: boolean // auto-trigger next turns

  fetchForCard: (cardId: string) => Promise<void>
  fetchConversation: (id: string) => Promise<void>
  createConversation: (data: { cardId?: string; type: string; agentIds: string[] }) => Promise<ConversationWithMessages>
  sendMessage: (id: string, content: string) => Promise<void>
  triggerNextTurn: (id: string) => Promise<void>
  pauseConversation: (id: string) => Promise<void>
  resumeConversation: (id: string) => Promise<void>
  setAutoRun: (enabled: boolean) => void

  // WebSocket handlers
  onMessage: (conversationId: string, message: Message) => void
  onStatusChange: (conversationId: string, status: string) => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  loading: false,
  autoRun: true,

  fetchForCard: async (cardId) => {
    const conversations = await api.conversations.listForCard(cardId)
    set({ conversations })
  },

  fetchConversation: async (id) => {
    set({ loading: true })
    const conv = await api.conversations.get(id)
    set({ activeConversation: conv, loading: false })
  },

  createConversation: async (data) => {
    const conv = await api.conversations.create(data)
    set((s) => ({ conversations: [conv, ...s.conversations], activeConversation: conv }))
    return conv
  },

  sendMessage: async (id, content) => {
    const msg = await api.conversations.sendMessage(id, content)
    set((s) => {
      if (!s.activeConversation || s.activeConversation.id !== id) return s
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: [...s.activeConversation.messages, msg],
          status: 'active',
        },
      }
    })
    // Auto-trigger next turn after user message
    if (get().autoRun) {
      setTimeout(() => get().triggerNextTurn(id), 500)
    }
  },

  triggerNextTurn: async (id) => {
    try {
      const result = await api.conversations.nextTurn(id) as any
      // Message is added via WebSocket, but update status
      if (result.conversationStatus === 'active' && result.nextAgentId && get().autoRun) {
        // Auto-continue to next agent
        setTimeout(() => get().triggerNextTurn(id), 1000)
      }
    } catch (err) {
      console.error('Turn failed:', err)
    }
  },

  pauseConversation: async (id) => {
    const conv = await api.conversations.pause(id)
    set((s) => ({
      activeConversation: s.activeConversation?.id === id
        ? { ...s.activeConversation, status: conv.status }
        : s.activeConversation,
    }))
  },

  resumeConversation: async (id) => {
    const conv = await api.conversations.resume(id)
    set((s) => ({
      activeConversation: s.activeConversation?.id === id
        ? { ...s.activeConversation, status: conv.status }
        : s.activeConversation,
    }))
    if (get().autoRun) {
      setTimeout(() => get().triggerNextTurn(id), 500)
    }
  },

  setAutoRun: (enabled) => set({ autoRun: enabled }),

  // WebSocket handlers
  onMessage: (conversationId, message) => {
    set((s) => {
      if (!s.activeConversation || s.activeConversation.id !== conversationId) return s
      return {
        activeConversation: {
          ...s.activeConversation,
          messages: [...s.activeConversation.messages, message],
        },
      }
    })
  },

  onStatusChange: (conversationId, status) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, status: status as any } : c
      ),
      activeConversation: s.activeConversation?.id === conversationId
        ? { ...s.activeConversation, status: status as any }
        : s.activeConversation,
    }))
  },
}))
