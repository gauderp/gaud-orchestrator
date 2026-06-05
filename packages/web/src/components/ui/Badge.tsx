import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-[--color-accent] text-[--color-on-accent]',
  warning: 'bg-[--color-warning] text-white',
  error: 'bg-[--color-destructive] text-[--color-on-destructive]',
  neutral: 'bg-[--color-surface] text-[--color-muted] border border-[--color-border] dark:bg-[--color-surface-dark] dark:text-[--color-muted-dark] dark:border-[--color-border-dark]',
  info: 'bg-[--color-primary] text-[--color-on-primary]',
}

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
