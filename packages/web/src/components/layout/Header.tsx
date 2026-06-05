import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[--color-border] bg-white px-6 dark:border-[--color-border-dark] dark:bg-[#09090B]">
      <div className="text-sm text-[--color-muted] dark:text-[--color-muted-dark]">
        Gaud Orchestrator
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
