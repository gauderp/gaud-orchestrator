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
          <label htmlFor={inputId} className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`min-h-[120px] rounded-[--radius-md] border px-3 py-2 text-sm font-mono transition-colors duration-150
            bg-white border-[--color-border] text-[--color-ink]
            focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:border-[--color-primary]
            dark:bg-[--color-surface-dark] dark:border-[--color-border-dark] dark:text-[--color-ink-dark]
            ${error ? 'border-[--color-destructive]' : ''} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[--color-destructive]">{error}</span>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
