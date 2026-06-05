import { useAppStore } from '@/store/app'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="rounded-[--radius-md] p-2 text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark] cursor-pointer transition-colors duration-150"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
