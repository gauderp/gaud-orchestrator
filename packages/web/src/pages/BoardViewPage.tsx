import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Settings, BarChart3, Plus } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { useAgentStore } from '@/store/agents'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { CardForm } from '@/components/cards/CardForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export function BoardViewPage() {
  const { id } = useParams<{ id: string }>()
  const { activeBoard, cards, fetchBoard, fetchCards, createCard, moveCard } = useBoardStore()
  const { agents, fetchAgents } = useAgentStore()
  const [showNewCard, setShowNewCard] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchBoard(id)
    fetchCards(id)
    fetchAgents()
  }, [id, fetchBoard, fetchCards, fetchAgents])

  const handleCreateCard = async (data: Parameters<typeof createCard>[0]) => {
    if (!id || !activeBoard?.columns.length) return
    const sorted = [...activeBoard.columns].sort((a, b) => a.position - b.position)
    const firstColumn = sorted[0]
    if (!firstColumn) return
    setCreating(true)
    try {
      await createCard({
        ...data,
        boardId: id,
        columnId: firstColumn.id,
        position: cards.filter((c) => c.columnId === firstColumn.id).length,
      })
      setShowNewCard(false)
    } finally {
      setCreating(false)
    }
  }

  if (!activeBoard) {
    return <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading board...</p>
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {activeBoard.name}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to={`/boards/${id}/gantt`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] dark:hover:text-[var(--color-ink-dark)]"
          >
            <BarChart3 size={16} />
            Gantt
          </Link>
          <Link
            to={`/boards/${id}/settings`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] dark:hover:text-[var(--color-ink-dark)]"
          >
            <Settings size={16} />
            Settings
          </Link>
          <Button onClick={() => setShowNewCard(true)}>
            <Plus size={16} className="mr-1.5" />
            New Card
          </Button>
        </div>
      </div>

      <KanbanBoard
        columns={activeBoard.columns}
        cards={cards}
        agents={agents}
        onMoveCard={moveCard}
        onAddCard={(columnId) => {
          setShowNewCard(true)
        }}
      />

      <Modal open={showNewCard} onClose={() => setShowNewCard(false)} title="New Card" width="lg">
        <CardForm onSubmit={handleCreateCard} loading={creating} />
      </Modal>
    </div>
  )
}
