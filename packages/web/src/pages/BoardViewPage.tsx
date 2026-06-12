import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart3, Bug, Plus, Pencil } from 'lucide-react'
import { BOARD_IDS } from '@gaud/shared'
import { useBoardStore } from '@/store/boards'
import { useAgentStore } from '@/store/agents'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { CardForm } from '@/components/cards/CardForm'
import { BugReportForm } from '@/components/bugs/BugReportForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export function BoardViewPage() {
  const { id } = useParams<{ id: string }>()
  const { activeBoard, cards, fetchBoard, fetchCards, createCard, moveCard } = useBoardStore()
  const { agents, fetchAgents } = useAgentStore()
  const [showNewCard, setShowNewCard] = useState(false)
  const [creating, setCreating] = useState(false)
  // On the Triage board, manual bugs must enter through the bug report flow
  // (report + conversation + card), not as bare cards
  const isTriage = id === BOARD_IDS.TRIAGE
  const isSpec = id === BOARD_IDS.SPEC

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

  const handleInlineAdd = async (columnId: string, title: string) => {
    if (!id) return
    if (isTriage) {
      // Inline add bypasses the bug report flow — open the report form instead
      setShowNewCard(true)
      return
    }
    await createCard({
      title,
      description: '',
      type: 'task',
      assignedAgentId: null,
      startDate: null,
      dueDate: null,
      boardId: id,
      columnId,
      position: cards.filter((c) => c.columnId === columnId).length,
    })
  }

  const handleBugReported = () => {
    setShowNewCard(false)
    if (id) fetchCards(id)
  }

  if (!activeBoard) {
    return (
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-6 w-40 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          <div className="h-9 w-24 rounded-[var(--radius-md)] bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] space-y-2">
              <div className="h-5 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse mb-2" />
              {[1, 2].map((j) => (
                <div key={j} className="h-16 rounded-[var(--radius-md)] bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
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
{isTriage ? (
            <Button variant="destructive" onClick={() => setShowNewCard(true)}>
              <Bug size={16} className="mr-1.5" />
              Report Bug
            </Button>
          ) : isSpec ? (
            <Link to="/specs/studio">
              <Button>
                <Pencil size={16} className="mr-1.5" />
                Spec Studio
              </Button>
            </Link>
          ) : (
            <Button onClick={() => setShowNewCard(true)}>
              <Plus size={16} className="mr-1.5" />
              New Card
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
      <KanbanBoard
        columns={activeBoard.columns}
        cards={cards}
        agents={agents}
        onMoveCard={moveCard}
        onAddCard={handleInlineAdd}
      />

      </div>

      <Modal open={showNewCard} onClose={() => setShowNewCard(false)} title={isTriage ? 'New Bug Report' : 'New Card'} width="lg">
        {isTriage ? (
          <BugReportForm onSuccess={handleBugReported} onCancel={() => setShowNewCard(false)} />
        ) : (
          <CardForm onSubmit={handleCreateCard} loading={creating} />
        )}
      </Modal>
    </div>
  )
}
