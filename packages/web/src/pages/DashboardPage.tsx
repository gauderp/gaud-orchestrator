import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import {
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Play,
  FileText,
  Bot,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

type DashboardData = Awaited<ReturnType<typeof api.dashboard>>

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
      <div className="flex items-center justify-center h-64 text-sm text-[var(--color-destructive)]">
        <AlertCircle size={16} className="mr-2" />
        Failed to load dashboard: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 max-w-5xl space-y-8">
        <div className="flex items-center gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-3 w-16 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-8 w-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-3 w-32 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Compute attention items
  const attentionItems: { icon: typeof AlertCircle; label: string; count: number; to: string; variant: 'warning' | 'error' | 'info' }[] = []
  if (data.conversations.pausedForUser > 0) {
    attentionItems.push({ icon: MessageSquare, label: 'Waiting for your input', count: data.conversations.pausedForUser, to: '/boards', variant: 'warning' })
  }
  if (data.executions.failed > 0) {
    attentionItems.push({ icon: AlertCircle, label: 'Failed executions', count: data.executions.failed, to: '/executions', variant: 'error' })
  }
  if (data.specs.pending > 0) {
    attentionItems.push({ icon: FileText, label: 'Specs awaiting review', count: data.specs.pending, to: '/specs', variant: 'warning' })
  }
  if (data.executions.active > 0) {
    attentionItems.push({ icon: Play, label: 'Executions running', count: data.executions.active, to: '/executions', variant: 'info' })
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Status bar */}
      <div className="flex items-center gap-6 text-[13px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-8">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${data.health.status === 'ok' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-destructive)]'}`} />
          API {data.health.status}
        </span>
        <span>{data.health.wsClients} client{data.health.wsClients !== 1 ? 's' : ''} connected</span>
        <span>${data.cost.totalThisMonth.toFixed(2)} this month</span>
        <span className="font-mono text-xs">{(data.cost.tokensIn / 1000).toFixed(0)}k in / {(data.cost.tokensOut / 1000).toFixed(0)}k out</span>
      </div>

      {/* Attention needed */}
      {attentionItems.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[13px] font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">Needs attention</h2>
          <div className="flex flex-col gap-1.5">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)]"
              >
                <item.icon size={16} className={
                  item.variant === 'error' ? 'text-[var(--color-destructive)]' :
                  item.variant === 'warning' ? 'text-[var(--color-warning)]' :
                  'text-[var(--color-primary)]'
                } />
                <span className="flex-1 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  {item.label}
                </span>
                <Badge variant={item.variant === 'error' ? 'error' : item.variant === 'warning' ? 'warning' : 'info'}>
                  {item.count}
                </Badge>
                <ArrowRight size={14} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Overview grid */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        <div>
          <h2 className="text-[13px] font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">Work</h2>
          <div className="flex flex-col gap-3">
            <Link to="/boards" className="group flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                <span className="text-2xl font-semibold">{data.cards.total}</span> cards
              </span>
              <ArrowRight size={14} className="text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            {Object.entries(data.cards.byType).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.cards.byType).map(([type, count]) => (
                  <span key={type} className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                    {count} {type}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {data.boards.total} board{data.boards.total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">Executions</h2>
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              <span className="text-2xl font-semibold">{data.executions.total}</span> total
            </span>
            <div className="flex gap-3 text-xs">
              {data.executions.active > 0 && (
                <span className="text-[var(--color-primary)]">{data.executions.active} active</span>
              )}
              {data.executions.done > 0 && (
                <span className="text-[var(--color-accent)]">{data.executions.done} done</span>
              )}
              {data.executions.failed > 0 && (
                <span className="text-[var(--color-destructive)]">{data.executions.failed} failed</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">Agents</h2>
          <div className="flex flex-col gap-3">
            <Link to="/agents" className="group flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                <span className="text-2xl font-semibold">{data.agents.total}</span> agents
              </span>
              <ArrowRight size={14} className="text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {data.agents.configured} configured, {data.skills.total} skill{data.skills.total !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {data.memories.total} memories ({data.memories.recentLearnings} this week)
            </div>
          </div>
        </div>
      </div>

      {/* Conversations */}
      {data.conversations.active > 0 && (
        <div>
          <h2 className="text-[13px] font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">Active conversations</h2>
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            <MessageSquare size={16} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
            {data.conversations.active} active
            {data.conversations.pausedForUser > 0 && (
              <Badge variant="warning">{data.conversations.pausedForUser} waiting</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
