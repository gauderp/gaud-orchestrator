import { useState } from 'react'
import type { MemoryType } from '@gaud/shared'
import { MEMORY_TYPES } from '@gaud/shared'
import { Search } from 'lucide-react'
import { MemoryCard } from './MemoryCard'
import { useMemoryStore } from '@/store/memory'

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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Semantic search..."
            className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
        {searchResults.length > 0 && (
          <button
            onClick={() => { clearSearch(); setSearchQuery('') }}
            className="rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => handleFilterChange('')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filterType === null
              ? 'bg-blue-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          All
        </button>
        {MEMORY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleFilterChange(type)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === type
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && <p className="text-sm text-neutral-500">Loading...</p>}

      {/* Memory cards */}
      <div className="space-y-3">
        {displayedMemories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} onDelete={deleteMemory} />
        ))}
        {!loading && displayedMemories.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No memories found</p>
          </div>
        )}
      </div>
    </div>
  )
}
