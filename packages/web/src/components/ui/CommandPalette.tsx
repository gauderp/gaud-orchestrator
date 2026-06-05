import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, Bot, LayoutGrid, FileText, Zap, Play } from 'lucide-react'
import { useAgentStore } from '@/store/agents'
import { useBoardStore } from '@/store/boards'
import { useSpecStore } from '@/store/specs'
import { useSkillStore } from '@/store/skills'

interface SearchResult {
  id: string
  label: string
  breadcrumb: string
  icon: typeof Bot
  href: string
  group: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const agents = useAgentStore((s) => s.agents)
  const boards = useBoardStore((s) => s.boards)
  const specs = useSpecStore((s) => s.specs)
  const skills = useSkillStore((s) => s.skills)

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Build search results
  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []

    // Pages
    const pages = [
      { label: 'Dashboard', href: '/', breadcrumb: 'Home' },
      { label: 'Agents', href: '/agents', breadcrumb: 'Navigation' },
      { label: 'Boards', href: '/boards', breadcrumb: 'Navigation' },
      { label: 'Skills', href: '/skills', breadcrumb: 'Navigation' },
      { label: 'Specs', href: '/specs', breadcrumb: 'Navigation' },
      { label: 'Executions', href: '/executions', breadcrumb: 'Navigation' },
      { label: 'Providers', href: '/settings/providers', breadcrumb: 'Settings' },
      { label: 'Spec Studio', href: '/specs/studio', breadcrumb: 'Navigation' },
    ]
    for (const p of pages) {
      results.push({ id: `page:${p.href}`, label: p.label, breadcrumb: p.breadcrumb, icon: LayoutGrid, href: p.href, group: 'Pages' })
    }

    // Agents
    for (const a of agents) {
      results.push({ id: `agent:${a.id}`, label: a.name, breadcrumb: a.role ?? 'Agent', icon: Bot, href: `/agents/${a.id}`, group: 'Agents' })
    }

    // Boards
    for (const b of boards) {
      results.push({ id: `board:${b.id}`, label: b.name, breadcrumb: 'Board', icon: LayoutGrid, href: `/boards/${b.id}`, group: 'Boards' })
    }

    // Specs
    for (const s of specs) {
      results.push({ id: `spec:${s.id}`, label: s.title, breadcrumb: `v${s.version} · ${s.status}`, icon: FileText, href: `/specs/${s.id}`, group: 'Specs' })
    }

    // Skills
    for (const s of skills) {
      results.push({ id: `skill:${s.id}`, label: s.name, breadcrumb: 'Skill', icon: Zap, href: `/skills/${s.id}`, group: 'Skills' })
    }

    return results
  }, [agents, boards, specs, skills])

  const filtered = useMemo(() => {
    if (!query.trim()) return allResults.slice(0, 20)
    const q = query.toLowerCase()
    return allResults.filter((r) => r.label.toLowerCase().includes(q) || r.breadcrumb.toLowerCase().includes(q))
  }, [allResults, query])

  // Group results
  const grouped = useMemo(() => {
    const groups: { name: string; items: SearchResult[] }[] = []
    const groupMap = new Map<string, SearchResult[]>()
    for (const r of filtered) {
      if (!groupMap.has(r.group)) groupMap.set(r.group, [])
      groupMap.get(r.group)!.push(r)
    }
    for (const [name, items] of groupMap) {
      groups.push({ name, items })
    }
    return groups
  }, [filtered])

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const selectResult = useCallback((result: SearchResult) => {
    setOpen(false)
    navigate(result.href)
  }, [navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) selectResult(filtered[selectedIndex])
    }
  }

  if (!open) return null

  // Compute flat index for highlighting
  let flatIndex = 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] dark:bg-[var(--color-surface-elevated-dark)] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 dark:border-[var(--color-border-dark)]">
          <Search size={16} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, agents, boards, specs..."
            className="flex-1 bg-transparent py-3 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] placeholder:text-[var(--color-muted)] dark:placeholder:text-[var(--color-muted-dark)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-muted-dark)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              No results found
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.name}>
              <p className="px-4 py-1 text-xs font-medium tracking-wide text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                {group.name.toUpperCase()}
              </p>
              {group.items.map((item) => {
                const idx = flatIndex++
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    onClick={() => selectResult(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]'
                        : 'hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)]'
                    }`}
                  >
                    <item.icon size={16} className="shrink-0 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
                    <span className="flex-1 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate">
                      {item.label}
                    </span>
                    <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] truncate">
                      {item.breadcrumb}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
