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

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

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
      <div className={`relative ${widths[width]} w-full mx-4 rounded-[--radius-xl] bg-white p-6 shadow-xl dark:bg-[--color-surface-elevated-dark]`}
        style={{ boxShadow: '0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">{title}</h2>
          <button onClick={onClose} className="rounded-[--radius-md] p-1 text-[--color-muted] hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark] cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
