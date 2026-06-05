import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`min-h-[120px] rounded-[var(--radius-md)] border px-3 py-2 text-sm font-mono transition-colors duration-150
            bg-white border-[var(--color-border)] text-[var(--color-ink)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)]
            dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-ink-dark)]
            ${error ? 'border-[var(--color-destructive)]' : ''} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--color-destructive)]">{error}</span>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
