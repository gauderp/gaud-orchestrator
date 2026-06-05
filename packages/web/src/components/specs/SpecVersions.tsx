import type { Spec } from '@gaud/shared'

interface SpecVersionsProps {
  spec: Spec
}

export function SpecVersions({ spec }: SpecVersionsProps) {
  const versions = Array.from({ length: spec.version }, (_, i) => spec.version - i)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Version History</h3>
      <div className="space-y-1">
        {versions.map((v) => {
          const isCurrent = v === spec.version
          const date = isCurrent
            ? new Date(spec.updatedAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
            : null

          return (
            <div
              key={v}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                isCurrent
                  ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] text-[var(--color-primary)] font-medium'
                  : 'text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)]'
              }`}
            >
              <span>v{v}</span>
              {date && <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{date}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
