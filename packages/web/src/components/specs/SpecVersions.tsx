import type { Spec } from '@gaud/shared'

interface SpecVersionsProps {
  spec: Spec
}

export function SpecVersions({ spec }: SpecVersionsProps) {
  const versions = Array.from({ length: spec.version }, (_, i) => spec.version - i)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Version History</h3>
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
                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span>v{v}</span>
              {date && <span className="text-xs text-gray-400">{date}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
