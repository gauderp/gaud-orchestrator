import { useEffect, useState, useCallback } from 'react'
import { api } from '@/api/client'
import {
  Activity,
  Bot,
  FileText,
  DollarSign,
  Zap,
  LayoutGrid,
  MessageSquare,
  Brain,
  Wrench,
  Columns3,
} from 'lucide-react'

type DashboardData = Awaited<ReturnType<typeof api.dashboard>>

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
      <div className="flex items-center gap-2 text-[--color-muted] dark:text-[--color-muted-dark]">
        <Icon size={16} />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent ?? 'text-[--color-ink] dark:text-[--color-ink-dark]'}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-[--color-muted] dark:text-[--color-muted-dark]">{sub}</div>}
    </div>
  )
}

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${color}`}>
      {label}: {count}
    </span>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (error) {
    return (
      <div className="p-8 text-center text-[--color-destructive]">
        Failed to load dashboard: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-[--color-muted] dark:text-[--color-muted-dark]">
        Loading dashboard...
      </div>
    )
  }

  const typeEntries = Object.entries(data.cards.byType)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">Dashboard</h1>

      {/* Row 1: Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="API Status"
          value={data.health.status}
          accent="text-[--color-accent]"
          sub={`${data.health.wsClients} WS client${data.health.wsClients !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={Bot}
          label="Agents"
          value={data.agents.total}
          sub={`${data.agents.configured} configured`}
        />
        <StatCard
          icon={FileText}
          label="Pending Specs"
          value={data.specs.pending}
          sub={`${data.specs.draft} draft + ${data.specs.review} review`}
        />
        <StatCard
          icon={DollarSign}
          label="Cost This Month"
          value={`$${data.cost.totalThisMonth.toFixed(2)}`}
          sub={`${(data.cost.tokensIn / 1000).toFixed(1)}k in / ${(data.cost.tokensOut / 1000).toFixed(1)}k out`}
        />
      </div>

      {/* Row 2: Operational */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="flex items-center gap-2 text-[--color-muted] dark:text-[--color-muted-dark]">
            <Zap size={16} />
            <span className="text-xs font-medium tracking-wide uppercase">Executions</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">{data.executions.total}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.executions.active > 0 && <Badge label="active" count={data.executions.active} color="bg-[--color-primary]" />}
            {data.executions.done > 0 && <Badge label="done" count={data.executions.done} color="bg-[--color-accent]" />}
            {data.executions.failed > 0 && <Badge label="failed" count={data.executions.failed} color="bg-[--color-destructive]" />}
          </div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="flex items-center gap-2 text-[--color-muted] dark:text-[--color-muted-dark]">
            <LayoutGrid size={16} />
            <span className="text-xs font-medium tracking-wide uppercase">Cards</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">{data.cards.total}</div>
          {typeEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {typeEntries.map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1 rounded-full border border-[--color-border] dark:border-[--color-border-dark] px-2 py-0.5 text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
                  {type}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="flex items-center gap-2 text-[--color-muted] dark:text-[--color-muted-dark]">
            <MessageSquare size={16} />
            <span className="text-xs font-medium tracking-wide uppercase">Conversations</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">{data.conversations.active}</div>
          <div className="mt-1 text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
            active
            {data.conversations.pausedForUser > 0 && (
              <span className="ml-2">
                <span className="inline-flex items-center rounded-full bg-[--color-warning] px-1.5 py-0.5 text-[10px] text-white">
                  {data.conversations.pausedForUser} waiting
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: System */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Brain}
          label="Memories"
          value={data.memories.total}
          sub={`${data.memories.recentLearnings} learnings this week`}
        />
        <StatCard
          icon={Wrench}
          label="Skills"
          value={data.skills.total}
        />
        <StatCard
          icon={Columns3}
          label="Boards"
          value={data.boards.total}
        />
      </div>
    </div>
  )
}
