import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useSpecStore } from '@/store/specs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { SpecStatus } from '@gaud/shared'

const STATUS_TABS: { label: string; value: SpecStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

const statusBadgeVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  review: 'warning',
  approved: 'success',
  rejected: 'error',
}

export function SpecReviewPage() {
  const { specs, loading, statusFilter, fetchSpecs, setStatusFilter } = useSpecStore()

  useEffect(() => {
    fetchSpecs()
  }, [fetchSpecs])

  const handleTabClick = (status: SpecStatus | null) => {
    setStatusFilter(status)
    fetchSpecs(status ?? undefined)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-lg font-semibold mb-4 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Specs</h1>

      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => handleTabClick(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              statusFilter === tab.value
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-40 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-3 w-8 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-3 w-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : specs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <FileText size={48} className="text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
          <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No specs found</p>
          <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Generate a spec from a card or create one in Spec Studio</p>
          <Link to="/specs/studio">
            <Button size="sm">Open Spec Studio</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <div
              key={spec.id}
              className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Link
                  to={`/specs/${spec.id}`}
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  {spec.title}
                </Link>
                <Badge variant={statusBadgeVariant[spec.status] ?? 'neutral'}>
                  {spec.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                <span>v{spec.version}</span>
                <span>{new Date(spec.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
