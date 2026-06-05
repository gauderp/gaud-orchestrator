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

const maxWidths = { sm: 448, md: 512, lg: 672 }

export function Modal({ open, onClose, title, children, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      />
      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: maxWidths[width],
          margin: '0 16px',
          borderRadius: 12,
          backgroundColor: '#fff',
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              padding: 4,
              borderRadius: 6,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
            }}
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
