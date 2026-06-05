import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, id, className, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-9 w-full rounded-md border px-3 text-sm bg-white dark:bg-[var(--color-surface-dark)] text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] placeholder:text-[var(--color-muted)] dark:placeholder:text-[var(--color-muted-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-[var(--color-destructive)]' : 'border-[var(--color-border)] dark:border-[var(--color-border-dark)]'} ${className ?? ''}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--color-destructive)]">{error}</span>}
        {helper && !error && <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{helper}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
