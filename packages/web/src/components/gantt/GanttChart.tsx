import type { Card, CardDependency } from '@gaud/shared'
import { GanttHeader } from './GanttHeader'
import { GanttBar } from './GanttBar'

interface ColumnInfo {
  id: string
  name: string
  color: string
}

interface GanttChartProps {
  cards: Card[]
  dependencies: CardDependency[]
  columns: ColumnInfo[]
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

const DAY_WIDTH = 20
const ROW_HEIGHT = 36
const BAR_HEIGHT = 24
const HEADER_HEIGHT = 40
const LEFT_LABEL_WIDTH = 160

export function GanttChart({ cards, dependencies, columns }: GanttChartProps) {
  const columnMap = new Map(columns.map((c) => [c.id, c]))

  // Filter cards that have at least a start or due date
  const datedCards = cards.filter((c) => c.startDate || c.dueDate)

  if (datedCards.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
        No cards with dates to display on the Gantt chart.
      </div>
    )
  }

  // Calculate date range
  const allDates: Date[] = []
  for (const card of datedCards) {
    if (card.startDate) allDates.push(new Date(card.startDate))
    if (card.dueDate) allDates.push(new Date(card.dueDate))
  }

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

  // Add padding: 7 days before and after
  const startDate = new Date(minDate)
  startDate.setDate(startDate.getDate() - 7)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(maxDate)
  endDate.setDate(endDate.getDate() + 7)
  endDate.setHours(0, 0, 0, 0)

  const totalDays = daysBetween(startDate, endDate)
  const svgWidth = LEFT_LABEL_WIDTH + totalDays * DAY_WIDTH
  const svgHeight = HEADER_HEIGHT + datedCards.length * ROW_HEIGHT + 20

  // Card position index for dependency arrows
  const cardRowIndex = new Map(datedCards.map((c, i) => [c.id, i]))

  function getBarProps(card: Card) {
    const start = card.startDate ? new Date(card.startDate) : new Date(card.dueDate!)
    const end = card.dueDate ? new Date(card.dueDate) : new Date(card.startDate!)
    const x = LEFT_LABEL_WIDTH + daysBetween(startDate, start) * DAY_WIDTH
    const width = Math.max((daysBetween(start, end) + 1) * DAY_WIDTH, 4)
    return { x, width }
  }

  // Filter relevant dependencies
  const cardIdSet = new Set(datedCards.map((c) => c.id))
  const relevantDeps = dependencies.filter((d) => cardIdSet.has(d.cardId) && cardIdSet.has(d.dependsOnCardId))

  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg bg-white dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)]">
      <svg width={svgWidth} height={svgHeight} className="min-w-full">
        {/* Header translated to account for label area */}
        <g transform={`translate(${LEFT_LABEL_WIDTH}, 0)`}>
          <GanttHeader
            startDate={startDate}
            endDate={endDate}
            dayWidth={DAY_WIDTH}
            headerHeight={HEADER_HEIGHT}
          />
        </g>

        {/* Row labels and bars */}
        {datedCards.map((card, i) => {
          const y = HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
          const col = columnMap.get(card.columnId)
          const { x, width } = getBarProps(card)

          return (
            <g key={card.id}>
              {/* Row background */}
              {i % 2 === 1 && (
                <rect
                  x={0}
                  y={HEADER_HEIGHT + i * ROW_HEIGHT}
                  width={svgWidth}
                  height={ROW_HEIGHT}
                  fill="var(--color-surface)"
                  opacity={0.4}
                />
              )}
              {/* Card label */}
              <text
                x={8}
                y={y + BAR_HEIGHT / 2 + 1}
                dominantBaseline="middle"
                className="text-[11px]"
                fill="var(--color-ink)"
              >
                {card.title.length > 20 ? card.title.slice(0, 19) + '...' : card.title}
              </text>
              {/* Bar */}
              <GanttBar
                x={x}
                y={y}
                width={width}
                color={col?.color ?? '#6b7280'}
                title={card.title}
                height={BAR_HEIGHT}
              />
            </g>
          )
        })}

        {/* Dependency arrows */}
        {relevantDeps.map((dep, i) => {
          const fromIdx = cardRowIndex.get(dep.dependsOnCardId)
          const toIdx = cardRowIndex.get(dep.cardId)
          if (fromIdx === undefined || toIdx === undefined) return null

          const fromCard = datedCards[fromIdx]
          const toCard = datedCards[toIdx]
          if (!fromCard || !toCard) return null
          const fromBar = getBarProps(fromCard)
          const toBar = getBarProps(toCard)

          const fromX = fromBar.x + fromBar.width
          const fromY = HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
          const toX = toBar.x
          const toY = HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2
          const midX = (fromX + toX) / 2

          return (
            <path
              key={`dep-${i}`}
              d={`M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth={1}
              markerEnd="url(#arrowhead)"
            />
          )
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--color-muted)" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}
