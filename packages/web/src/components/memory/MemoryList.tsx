import { useState } from 'react'
import type { MemoryType } from '@gaud/shared'
import { MEMORY_TYPES } from '@gaud/shared'
import { Search } from 'lucide-react'
import { MemoryCard } from './MemoryCard'
import { useMemoryStore } from '@/store/memory'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface MemoryListProps {
  agentId: string
}

export function MemoryList({ agentId }: MemoryListProps) {
  const {
    memories, searchResults, loading, filterType,
    setFilterType, loadMemories, search, clearSearch, deleteMemory,
  } = useMemoryStore()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = () => {
    if (searchQuery.trim()) {
      search(agentId, searchQuery.trim())
    } else {
      clearSearch()
    }
  }

  const handleFilterChange = (type: string) => {
    const newType = type === '' ? null : (type as MemoryType)
    setFilterType(newType)
    loadMemories(agentId)
  }

  const displayedMemories = searchResults.length > 0 ? searchResults : memories

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2 items-end">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Semantic search..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} size="md">
          Search
        </Button>
        {searchResults.length > 0 && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => { clearSearch(); setSearchQuery('') }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => handleFilterChange('')}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filterType === null
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] hover:bg-[var(--color-border)] dark:hover:bg-[var(--color-border-dark)]'
          }`}
        >
          All
        </button>
        {MEMORY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleFilterChange(type)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === type
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] hover:bg-[var(--color-border)] dark:hover:bg-[var(--color-border-dark)]'
            }`}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</p>}

      {/* Memory cards */}
      <div className="space-y-3">
        {displayedMemories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} onDelete={deleteMemory} />
        ))}
        {!loading && displayedMemories.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No memories found</p>
          </div>
        )}
      </div>
    </div>
  )
}
