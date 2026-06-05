import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/app'
import {
  LayoutDashboard, Bot, Zap, Plug,
  Kanban, FileText, Play,
  Settings, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import type { ComponentType } from 'react'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ size?: number }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Agents',
    items: [
      { label: 'Agents', to: '/agents', icon: Bot },
      { label: 'Skills', to: '/skills', icon: Zap },
      { label: 'Providers', to: '/settings/providers', icon: Plug },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Boards', to: '/boards', icon: Kanban },
      { label: 'Specs', to: '/specs', icon: FileText },
      { label: 'Executions', to: '/executions', icon: Play },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <aside className={`flex flex-col border-r border-[var(--color-border)] bg-white transition-all duration-200 dark:border-[var(--color-border-dark)] dark:bg-[#09090B] ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo + collapse */}
      <div className="flex h-12 items-center justify-between px-4">
        {!sidebarCollapsed && (
          <span className="text-sm font-bold tracking-tight text-[var(--color-primary)]">Gaud</span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)] cursor-pointer transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3">
            {!sidebarCollapsed && (
              <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-md px-3 h-9 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-medium dark:bg-[var(--color-surface-elevated-dark)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--color-primary)]" />
                    )}
                    <item.icon size={18} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
