import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Brain, ArrowLeft } from 'lucide-react'
import { MemoryList } from '@/components/memory/MemoryList'
import { useMemoryStore } from '@/store/memory'
import { useAgentStore } from '@/store/agents'

export function AgentMemoryPage() {
  const { id } = useParams<{ id: string }>()
  const { loadMemories, loadStats, stats } = useMemoryStore()
  const { selectedAgent, fetchAgent } = useAgentStore()

  useEffect(() => {
    if (id) {
      fetchAgent(id)
      loadMemories(id)
      loadStats()
    }
  }, [id, fetchAgent, loadMemories, loadStats])

  if (!id) return null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/agents/${id}`} className="rounded p-1 hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-elevated-dark)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Brain size={24} className="text-[var(--color-primary)]" />
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{selectedAgent?.name ?? 'Agent'} Memory</h1>
          <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Long-term learnings and knowledge</p>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Memories" value={stats.totalMemories} />
          <StatCard label="Error Corrections" value={stats.byType.error_correction ?? 0} color="text-[var(--color-destructive)]" />
          <StatCard label="Patterns Learned" value={stats.byType.pattern_success ?? 0} color="text-[var(--color-accent)]" />
          <StatCard label="User Preferences" value={stats.byType.user_preference ?? 0} color="text-[var(--color-warning)]" />
        </div>
      )}

      {/* Memory list */}
      <MemoryList agentId={id} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] px-3 py-2">
      <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{label}</p>
      <p className={`text-lg font-semibold ${color ?? 'text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]'}`}>{value}</p>
    </div>
  )
}
