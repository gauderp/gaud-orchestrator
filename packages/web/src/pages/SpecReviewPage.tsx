import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useSpecStore } from '@/store/specs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SPEC_COLUMNS } from '@gaud/shared'

const columnLabels: Record<string, string> = {
  [SPEC_COLUMNS.IDEAS]: 'Ideas',
  [SPEC_COLUMNS.DRAFTING]: 'Drafting',
  [SPEC_COLUMNS.REVIEW]: 'Review',
  [SPEC_COLUMNS.APPROVED]: 'Approved',
}

const columnBadgeVariant: Record<string, 'neutral' | 'warning' | 'success' | 'info'> = {
  [SPEC_COLUMNS.IDEAS]: 'neutral',
  [SPEC_COLUMNS.DRAFTING]: 'info',
  [SPEC_COLUMNS.REVIEW]: 'warning',
  [SPEC_COLUMNS.APPROVED]: 'success',
}

export function SpecReviewPage() {
  const { specs, loading, fetchSpecs } = useSpecStore()

  useEffect(() => {
    fetchSpecs()
  }, [fetchSpecs])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-lg font-semibold mb-4 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Specs</h1>

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
          {specs.map((spec) => {
            const colId = (spec as any).columnId as string | undefined
            const label = colId ? (columnLabels[colId] ?? colId) : 'Unknown'
            const variant = colId ? (columnBadgeVariant[colId] ?? 'neutral') : 'neutral'
            return (
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
                  <Badge variant={variant}>
                    {label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  <span>v{spec.version}</span>
                  <span>{new Date(spec.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
