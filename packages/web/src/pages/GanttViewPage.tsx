import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { api } from '@/api/client'
import { GanttChart } from '@/components/gantt/GanttChart'
import type { Card, CardDependency } from '@gaud/shared'

interface GanttData {
  cards: Card[]
  dependencies: CardDependency[]
  columns: { id: string; name: string; color: string }[]
}

export function GanttViewPage() {
  const { id } = useParams<{ id: string }>()
  const { activeBoard, fetchBoard } = useBoardStore()
  const [ganttData, setGanttData] = useState<GanttData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetchBoard(id)
    setLoading(true)
    api.boards.gantt(id).then((data) => {
      setGanttData(data)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [id, fetchBoard])

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {activeBoard?.name ?? 'Gantt View'}
        </h1>
        <Link
          to={`/boards/${id}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] dark:hover:text-[var(--color-ink-dark)]"
        >
          <LayoutGrid size={16} />
          Kanban
        </Link>
      </div>

      {loading && (
        <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading gantt data...</p>
      )}

      {!loading && ganttData && (
        <GanttChart
          cards={ganttData.cards}
          dependencies={ganttData.dependencies}
          columns={ganttData.columns}
        />
      )}

      {!loading && !ganttData && (
        <p className="text-center py-12 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          Failed to load Gantt data.
        </p>
      )}
    </div>
  )
}
