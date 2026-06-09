import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBoardStore } from '@/store/boards'
import { CardDetail } from '@/components/cards/CardDetail'
import { BUG_BOARD_ID } from '@gaud/shared'
import { api } from '@/api/client'

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCard, fetchCard, activeBoard, fetchBoard } = useBoardStore()
  const [checkedBugRedirect, setCheckedBugRedirect] = useState(false)

  useEffect(() => {
    if (id) fetchCard(id)
  }, [id, fetchCard])

  useEffect(() => {
    if (selectedCard && !activeBoard) {
      fetchBoard(selectedCard.boardId)
    }
  }, [selectedCard, activeBoard, fetchBoard])

  // Redirect bug cards to their bug report page
  useEffect(() => {
    if (selectedCard && !checkedBugRedirect) {
      setCheckedBugRedirect(true)
      if (selectedCard.type === 'bug' || selectedCard.boardId === BUG_BOARD_ID) {
        api.bugReports.list().then(reports => {
          const bugReport = reports.find((r: any) => r.cardId === selectedCard.id)
          if (bugReport) navigate(`/bugs/${bugReport.id}`, { replace: true })
        }).catch(() => {})
      }
    }
  }, [selectedCard, checkedBugRedirect, navigate])

  if (!selectedCard) {
    return (
      <div className="p-6 flex gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-6 w-48 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          <div className="h-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          <div className="h-32 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
        </div>
        <div className="w-[280px] space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-5 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const columnName = activeBoard?.columns.find((c) => c.id === selectedCard.columnId)?.name

  return (
    <div className="p-6">
      <CardDetail
        card={selectedCard}
        columnName={columnName}
        onUpdate={() => { if (id) fetchCard(id) }}
      />
    </div>
  )
}
