import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-[var(--color-accent)] text-[var(--color-on-accent)]',
  warning: 'bg-[var(--color-warning)] text-white',
  error: 'bg-[var(--color-destructive)] text-[var(--color-on-destructive)]',
  neutral: 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-muted-dark)] dark:border-[var(--color-border-dark)]',
  info: 'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
}

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
