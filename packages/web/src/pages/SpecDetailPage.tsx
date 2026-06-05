import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import { SpecEditor } from '@/components/specs/SpecEditor'
import { SpecReviewPanel } from '@/components/specs/SpecReviewPanel'
import { SpecVersions } from '@/components/specs/SpecVersions'
import { DecomposeModal } from '@/components/specs/DecomposeModal'

const statusBadgeClass: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

type Tab = 'content' | 'reviews' | 'versions'

export function SpecDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedSpec, fetchSpec } = useSpecStore()
  const [activeTab, setActiveTab] = useState<Tab>('content')
  const [decomposeOpen, setDecomposeOpen] = useState(false)

  useEffect(() => {
    if (id) fetchSpec(id)
  }, [id, fetchSpec])

  if (!selectedSpec) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'content', label: 'Content' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'versions', label: 'Versions' },
  ]

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/specs" className="text-blue-600 hover:underline dark:text-blue-400 text-sm mb-4 inline-block">
        &larr; Back to Specs
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{selectedSpec.title}</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass[selectedSpec.status] ?? ''}`}>
          {selectedSpec.status}
        </span>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          v{selectedSpec.version}
        </span>
        {selectedSpec.status === 'approved' && (
          <button
            onClick={() => setDecomposeOpen(true)}
            className="ml-auto rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white font-medium hover:bg-green-700"
          >
            Decompose to Board
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'content' && <SpecEditor spec={selectedSpec} />}
      {activeTab === 'reviews' && <SpecReviewPanel specId={selectedSpec.id} reviews={selectedSpec.reviews} />}
      {activeTab === 'versions' && <SpecVersions spec={selectedSpec} />}

      {id && (
        <DecomposeModal specId={id} open={decomposeOpen} onClose={() => setDecomposeOpen(false)} />
      )}
    </div>
  )
}
