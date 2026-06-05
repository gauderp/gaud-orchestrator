import { useLocation } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/agents': 'Agents',
  '/skills': 'Skills',
  '/settings/providers': 'Providers',
  '/boards': 'Boards',
  '/specs': 'Specs',
  '/specs/studio': 'Spec Studio',
  '/executions': 'Executions',
  '/settings': 'Settings',
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? ''

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-white px-6 dark:border-[var(--color-border-dark)] dark:bg-[#09090B]">
      <div className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
        {title}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
