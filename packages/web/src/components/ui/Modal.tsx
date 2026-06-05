import { useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const maxWidths: Record<string, number> = { sm: 448, md: 512, lg: 672 }

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
}

const closeButtonStyle: CSSProperties = {
  padding: 4,
  borderRadius: 6,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
}

export function Modal({ open, onClose, title, children, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const dialogStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: maxWidths[width],
    margin: '0 16px',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 24,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  }

  const titleStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    color: '#0f172a',
  }

  return createPortal(
    <div style={overlayStyle}>
      <div style={backdropStyle} onClick={onClose} />
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
