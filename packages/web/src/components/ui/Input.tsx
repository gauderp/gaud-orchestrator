import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, id, style, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label && (
          <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 500 }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            height: 36,
            borderRadius: 6,
            border: `1px solid ${error ? '#DC2626' : '#E2E8F0'}`,
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 14,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#fff',
            ...style,
          }}
          {...props}
        />
        {error && <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>}
        {helper && !error && <span style={{ fontSize: 12, color: '#64748B' }}>{helper}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
