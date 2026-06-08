import { useLocation, useParams, Link } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { useAgentStore } from '@/store/agents'
import { useSpecStore } from '@/store/specs'
import { useExecutionStore } from '@/store/executions'
import { useAuthStore } from '@/store/auth'
import { Badge } from '@/components/ui/Badge'

interface Crumb {
  label: string
  to?: string
}

function useBreadcrumbs(): Crumb[] {
  const location = useLocation()
  const params = useParams()
  const activeBoard = useBoardStore((s) => s.activeBoard)
  const selectedAgent = useAgentStore((s) => s.selectedAgent)
  const selectedSpec = useSpecStore((s) => s.selectedSpec)
  const selectedExecution = useExecutionStore((s) => s.selectedExecution)

  const path = location.pathname

  if (path === '/') return [{ label: 'Dashboard' }]

  if (path === '/agents') return [{ label: 'Agents' }]
  if (path.startsWith('/agents/') && params.id) {
    const name = selectedAgent?.name ?? `Agent ${params.id.slice(0, 8)}`
    if (path.endsWith('/memory')) {
      return [
        { label: 'Agents', to: '/agents' },
        { label: name, to: `/agents/${params.id}` },
        { label: 'Memory' },
      ]
    }
    return [{ label: 'Agents', to: '/agents' }, { label: name }]
  }

  if (path === '/skills') return [{ label: 'Skills' }]
  if (path === '/skills/new') return [{ label: 'Skills', to: '/skills' }, { label: 'New Skill' }]
  if (path.startsWith('/skills/') && params.id) {
    return [{ label: 'Skills', to: '/skills' }, { label: 'Edit Skill' }]
  }

  if (path === '/settings/providers') return [{ label: 'Providers' }]
  if (path === '/settings/users') return [{ label: 'Users' }]
  if (path === '/settings') return [{ label: 'Settings' }]

  if (path === '/boards') return [{ label: 'Boards' }]
  if (path.startsWith('/boards/') && params.id) {
    const boardName = activeBoard?.name ?? `Board ${params.id.slice(0, 8)}`
    if (path.endsWith('/gantt')) {
      return [
        { label: 'Boards', to: '/boards' },
        { label: boardName, to: `/boards/${params.id}` },
        { label: 'Gantt' },
      ]
    }
    if (path.endsWith('/settings')) {
      return [
        { label: 'Boards', to: '/boards' },
        { label: boardName, to: `/boards/${params.id}` },
        { label: 'Settings' },
      ]
    }
    return [{ label: 'Boards', to: '/boards' }, { label: boardName }]
  }

  if (path.startsWith('/cards/') && params.id) {
    return [{ label: 'Boards', to: '/boards' }, { label: `Card ${params.id.slice(0, 8)}` }]
  }

  if (path.startsWith('/conversations/') && params.id) {
    return [{ label: 'Conversation' }]
  }

  if (path === '/specs') return [{ label: 'Specs' }]
  if (path === '/specs/studio') return [{ label: 'Specs', to: '/specs' }, { label: 'Studio' }]
  if (path.startsWith('/specs/') && params.id) {
    const specTitle = selectedSpec?.title ?? `Spec ${params.id.slice(0, 8)}`
    return [{ label: 'Specs', to: '/specs' }, { label: specTitle }]
  }

  if (path === '/executions') return [{ label: 'Executions' }]
  if (path.startsWith('/executions/') && params.id) {
    const execLabel = `Execution ${(selectedExecution?.id ?? params.id).slice(0, 8)}`
    return [{ label: 'Executions', to: '/executions' }, { label: execLabel }]
  }

  return [{ label: path.replace(/^\//, '') }]
}

export function Header() {
  const crumbs = useBreadcrumbs()
  const { user, logout } = useAuthStore()

  return (
    <header className="flex h-11 items-center border-b border-[var(--color-border)] bg-white px-4 dark:border-[var(--color-border-dark)] dark:bg-[#09090B]">
      <nav className="flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />}
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]' : 'text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]'}>
                  {crumb.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {user && (
          <>
            <span className="text-[13px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{user.name}</span>
            <Badge variant="neutral">{user.role}</Badge>
            <button
              onClick={logout}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-elevated)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)] cursor-pointer transition-colors"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
