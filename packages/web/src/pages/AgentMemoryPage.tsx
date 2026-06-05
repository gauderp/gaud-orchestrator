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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/agents/${id}`} className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Brain size={24} className="text-purple-600" />
        <div>
          <h1 className="text-2xl font-semibold">{selectedAgent?.name ?? 'Agent'} Memory</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Long-term learnings and knowledge</p>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Memories" value={stats.totalMemories} />
          <StatCard label="Error Corrections" value={stats.byType.error_correction ?? 0} color="text-red-600" />
          <StatCard label="Patterns Learned" value={stats.byType.pattern_success ?? 0} color="text-emerald-600" />
          <StatCard label="User Preferences" value={stats.byType.user_preference ?? 0} color="text-amber-600" />
        </div>
      )}

      {/* Memory list */}
      <MemoryList agentId={id} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-neutral-900 dark:text-neutral-100'}`}>{value}</p>
    </div>
  )
}
