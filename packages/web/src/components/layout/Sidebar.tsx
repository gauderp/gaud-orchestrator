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
    <aside className={`flex flex-col border-r border-[--color-border] bg-white transition-all duration-200 dark:border-[--color-border-dark] dark:bg-[#09090B] ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex h-14 items-center justify-between border-b border-[--color-border] px-4 dark:border-[--color-border-dark]">
        {!sidebarCollapsed && (
          <span className="text-sm font-bold text-[--color-primary]">Gaud</span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-[--radius-md] p-1.5 text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark] cursor-pointer"
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {!sidebarCollapsed && (
              <div className="mb-1 px-3 text-[0.6875rem] font-medium uppercase tracking-wider text-[--color-muted] dark:text-[--color-muted-dark]">
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-[--radius-md] px-3 h-9 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-[--color-surface] text-[--color-primary] dark:bg-[--color-surface-dark] dark:text-[--color-primary]'
                      : 'text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]'
                  }`
                }
              >
                <item.icon size={18} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
