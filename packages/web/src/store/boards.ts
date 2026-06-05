import { create } from 'zustand'
import type { Board, BoardWithColumns, Card, CardWithDetails } from '@gaud/shared'
import { api } from '@/api/client'

interface BoardState {
  boards: Board[]
  activeBoard: BoardWithColumns | null
  cards: Card[]
  selectedCard: CardWithDetails | null
  loading: boolean
  fetchBoards: () => Promise<void>
  fetchBoard: (id: string) => Promise<void>
  fetchCards: (boardId: string) => Promise<void>
  fetchCard: (id: string) => Promise<void>
  createBoard: (name: string) => Promise<Board>
  createCard: (data: any) => Promise<Card>
  moveCard: (cardId: string, columnId: string, position: number) => Promise<void>
  updateCard: (id: string, data: any) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  onCardMoved: (card: Card) => void
  onCardCreated: (card: Card) => void
  onCardUpdated: (card: Card) => void
  onCardDeleted: (id: string) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  activeBoard: null,
  cards: [],
  selectedCard: null,
  loading: false,

  fetchBoards: async () => {
    set({ loading: true })
    const boards = await api.boards.list()
    set({ boards, loading: false })
  },
  fetchBoard: async (id) => {
    const board = await api.boards.get(id)
    set({ activeBoard: board })
  },
  fetchCards: async (boardId) => {
    const cards = await api.cards.list(boardId)
    set({ cards })
  },
  fetchCard: async (id) => {
    const card = await api.cards.get(id)
    set({ selectedCard: card })
  },
  createBoard: async (name) => {
    const board = await api.boards.create({ name })
    set((s) => ({ boards: [...s.boards, board] }))
    return board
  },
  createCard: async (data) => {
    const card = await api.cards.create(data)
    set((s) => ({ cards: [...s.cards, card] }))
    return card
  },
  moveCard: async (cardId, columnId, position) => {
    await api.cards.move(cardId, { columnId, position })
  },
  updateCard: async (id, data) => {
    const card = await api.cards.update(id, data)
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? card : c)) }))
  },
  deleteCard: async (id) => {
    await api.cards.delete(id)
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }))
  },
  onCardMoved: (card) => set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? card : c)) })),
  onCardCreated: (card) => set((s) => ({ cards: [...s.cards, card] })),
  onCardUpdated: (card) => set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? card : c)) })),
  onCardDeleted: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
}))
