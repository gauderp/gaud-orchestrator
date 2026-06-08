import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const maxWidths: Record<string, string> = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full ${maxWidths[width]} mx-4 rounded-[var(--radius-xl)] bg-white p-6 shadow-xl dark:bg-[var(--color-surface-dark)] dark:border dark:border-[var(--color-border-dark)]`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center rounded-[var(--radius-md)] p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
