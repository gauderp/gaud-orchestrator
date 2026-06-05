import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-9 rounded-[--radius-md] border px-3 text-sm transition-colors duration-150
            bg-white border-[--color-border] text-[--color-ink] placeholder:text-[--color-muted]
            focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:border-[--color-primary]
            disabled:opacity-50 disabled:cursor-not-allowed
            dark:bg-[--color-surface-dark] dark:border-[--color-border-dark] dark:text-[--color-ink-dark] dark:placeholder:text-[--color-muted-dark]
            ${error ? 'border-[--color-destructive] focus:ring-[--color-destructive]' : ''}
            ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[--color-destructive]">{error}</span>}
        {helper && !error && <span className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">{helper}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
