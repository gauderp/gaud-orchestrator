import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import { SpecEditor } from '@/components/specs/SpecEditor'
import { SpecReviewPanel } from '@/components/specs/SpecReviewPanel'
import { SpecVersions } from '@/components/specs/SpecVersions'
import { DecomposeModal } from '@/components/specs/DecomposeModal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

const statusBadgeVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral',
  review: 'warning',
  approved: 'success',
  rejected: 'error',
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
      <div className="mx-auto max-w-4xl">
        <div className="text-center py-12 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'content', label: 'Content' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'versions', label: 'Versions' },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/specs"
        className="text-[var(--color-primary)] hover:underline dark:text-[var(--color-primary)] text-sm mb-4 inline-block"
      >
        &larr; Back to Specs
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {selectedSpec.title}
        </h1>
        <Badge variant={statusBadgeVariant[selectedSpec.status] ?? 'neutral'}>
          {selectedSpec.status}
        </Badge>
        <Badge variant="neutral">v{selectedSpec.version}</Badge>
        {selectedSpec.status === 'approved' && (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={() => setDecomposeOpen(true)}
          >
            Decompose to Board
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
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
