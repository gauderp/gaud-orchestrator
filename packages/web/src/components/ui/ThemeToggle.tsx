import { useAppStore } from '@/store/app'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-elevated)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)] cursor-pointer transition-colors duration-100"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
