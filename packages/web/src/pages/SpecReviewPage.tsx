import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import { Badge } from '@/components/ui/Badge'
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
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Spec Review</h1>

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
        <div className="text-center py-12 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
      ) : specs.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No specs found</div>
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
