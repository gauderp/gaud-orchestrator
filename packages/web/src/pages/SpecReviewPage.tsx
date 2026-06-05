import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import type { SpecStatus } from '@gaud/shared'

const STATUS_TABS: { label: string; value: SpecStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

const statusBadgeClass: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
      <h1 className="text-2xl font-bold mb-6">Spec Review</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => handleTabClick(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              statusFilter === tab.value
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : specs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No specs found</div>
      ) : (
        <div className="space-y-2">
          {specs.map((spec) => (
            <div
              key={spec.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Link
                  to={`/specs/${spec.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                >
                  {spec.title}
                </Link>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[spec.status] ?? ''}`}>
                  {spec.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
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
