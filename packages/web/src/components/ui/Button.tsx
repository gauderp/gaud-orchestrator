import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-[--radius-md] font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[--color-primary] text-[--color-on-primary] hover:bg-[--color-primary-hover]',
    secondary: 'bg-transparent text-[--color-ink] border border-[--color-border] hover:bg-[--color-surface] dark:text-[--color-ink-dark] dark:border-[--color-border-dark] dark:hover:bg-[--color-surface-dark]',
    ghost: 'text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]',
    destructive: 'bg-[--color-destructive] text-[--color-on-destructive] hover:bg-[--color-destructive-hover]',
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
