import { useState } from 'react'
import { OrgChart } from '@/components/agents/OrgChart'
import { GitBranch, LayoutList, Network } from 'lucide-react'

export function OrgChartPage() {
  const [compact, setCompact] = useState(false)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={20} className="text-[var(--color-primary)]" />
          <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Organization
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Compact toggle */}
          <button
            onClick={() => setCompact(!compact)}
            className={`flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 h-8 text-sm font-medium cursor-pointer transition-colors border ${
              compact
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-muted-dark)]'
            }`}
          >
            {compact ? <LayoutList size={14} /> : <Network size={14} />}
            {compact ? 'Compact' : 'Detailed'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div
        className="mb-4 flex items-center gap-4 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]"
      >
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
          Agent
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning, #f59e0b)' }} />
          Requires Approval
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 2, height: 12, background: 'var(--color-border)' }} />
          Reports to
        </span>
      </div>

      {/* Chart */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <OrgChart compact={compact} />
      </div>
    </div>
  )
}
