import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 dark:focus:ring-offset-[var(--color-bg-dark)] disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]',
    secondary: 'bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] dark:text-[var(--color-ink-dark)] dark:border-[var(--color-border-dark)] dark:hover:bg-[var(--color-surface-dark)]',
    ghost: 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)]',
    destructive: 'bg-[var(--color-destructive)] text-[var(--color-on-destructive)] hover:bg-[var(--color-destructive-hover)]',
  }
  const sizes = {
    sm: 'h-7 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-sm',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : null}
      {children}
    </button>
  )
}
