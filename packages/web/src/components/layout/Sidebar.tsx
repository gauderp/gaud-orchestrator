import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/app'
import {
  LayoutDashboard, Bot, Zap, Plug,
  Kanban, FileText, Play,
  ChevronsLeft, ChevronsRight,
  Search,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { ComponentType } from 'react'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Boards', to: '/boards', icon: Kanban },
  { label: 'Specs', to: '/specs', icon: FileText },
  { label: 'Executions', to: '/executions', icon: Play },
]

const configNav: NavItem[] = [
  { label: 'Agents', to: '/agents', icon: Bot },
  { label: 'Skills', to: '/skills', icon: Zap },
  { label: 'Providers', to: '/settings/providers', icon: Plug },
]

function NavSection({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            [
              'group flex items-center rounded-[var(--radius-md)] transition-colors duration-100',
              collapsed ? 'justify-center h-8 w-8 mx-auto' : 'gap-2.5 h-8 px-2.5',
              isActive
                ? 'bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)] dark:bg-[var(--color-primary)]/[0.15]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-elevated)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)]',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={16} className={isActive ? 'text-[var(--color-primary)]' : ''} />
              {!collapsed && (
                <span className={`text-[13px] ${isActive ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const location = useLocation()

  // Show search hint
  const isMac = navigator.platform.includes('Mac')
  const searchHint = isMac ? '⌘K' : 'Ctrl+K'

  return (
    <aside
      className={[
        'flex flex-col border-r border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-[#09090B]',
        'transition-[width] duration-200 ease-out',
        sidebarCollapsed ? 'w-14' : 'w-52',
      ].join(' ')}
    >
      {/* Brand */}
      <div className={`flex items-center h-12 ${sidebarCollapsed ? 'justify-center' : 'px-3'}`}>
        {sidebarCollapsed ? (
          <span className="text-[15px] font-bold tracking-tight text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">G</span>
        ) : (
          <span className="text-[15px] font-bold tracking-tight text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Gaud<span className="font-normal text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">.ai</span>
          </span>
        )}
      </div>

      {/* Search trigger */}
      {!sidebarCollapsed && (
        <div className="px-2.5 mb-3">
          <button
            className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 h-8 text-[13px] text-[var(--color-muted)] hover:border-[var(--color-muted)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-muted-dark)] dark:hover:border-[var(--color-muted-dark)] transition-colors cursor-pointer"
            onClick={() => {/* TODO: command palette */}}
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[11px] font-mono text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">{searchHint}</kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-1.5' : 'px-2.5'}`}>
        <NavSection items={mainNav} collapsed={sidebarCollapsed} />
        <div className="my-3 mx-2 h-px bg-[var(--color-border)] dark:bg-[var(--color-border-dark)]" />
        <NavSection items={configNav} collapsed={sidebarCollapsed} />
      </nav>

      {/* Footer */}
      <div className={`flex items-center border-t border-[var(--color-border)] dark:border-[var(--color-border-dark)] h-11 ${sidebarCollapsed ? 'justify-center' : 'px-2.5 justify-between'}`}>
        <ThemeToggle />
        <button
          onClick={toggleSidebar}
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-elevated)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)] cursor-pointer transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}
