interface GanttHeaderProps {
  startDate: Date
  endDate: Date
  dayWidth: number
  headerHeight: number
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function GanttHeader({ startDate, endDate, dayWidth, headerHeight }: GanttHeaderProps) {
  const totalDays = daysBetween(startDate, endDate)
  const totalWidth = totalDays * dayWidth
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate month labels
  const months: { label: string; x: number; width: number }[] = []
  let current = new Date(startDate)
  while (current < endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
    const visibleStart = monthStart < startDate ? startDate : monthStart
    const visibleEnd = monthEnd > endDate ? endDate : monthEnd
    const x = daysBetween(startDate, visibleStart) * dayWidth
    const width = (daysBetween(visibleStart, visibleEnd) + 1) * dayWidth
    months.push({ label: formatMonth(visibleStart), x, width })
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  // Generate week labels (every 7 days)
  const weeks: { label: string; x: number }[] = []
  let weekDate = new Date(startDate)
  // Align to Monday
  const dayOfWeek = weekDate.getDay()
  const offset = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  weekDate = addDays(weekDate, offset)
  while (weekDate < endDate) {
    const x = daysBetween(startDate, weekDate) * dayWidth
    weeks.push({ label: formatWeek(weekDate), x })
    weekDate = addDays(weekDate, 7)
  }

  // Gridlines for weeks
  const gridLines = weeks.map((w) => w.x)

  // Today marker
  const todayX = today >= startDate && today <= endDate ? daysBetween(startDate, today) * dayWidth : null

  return (
    <g>
      {/* Month labels */}
      {months.map((m, i) => (
        <text
          key={`month-${i}`}
          x={m.x + m.width / 2}
          y={14}
          textAnchor="middle"
          className="text-[10px] font-medium"
          fill="var(--color-ink)"
        >
          {m.label}
        </text>
      ))}

      {/* Week labels */}
      {weeks.map((w, i) => (
        <text
          key={`week-${i}`}
          x={w.x}
          y={30}
          textAnchor="start"
          className="text-[9px]"
          fill="var(--color-muted)"
        >
          {w.label}
        </text>
      ))}

      {/* Vertical gridlines */}
      {gridLines.map((x, i) => (
        <line
          key={`grid-${i}`}
          x1={x}
          y1={headerHeight}
          x2={x}
          y2={9999}
          stroke="var(--color-border)"
          strokeWidth={0.5}
        />
      ))}

      {/* Today marker */}
      {todayX !== null && (
        <line
          x1={todayX}
          y1={0}
          x2={todayX}
          y2={9999}
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </g>
  )
}
