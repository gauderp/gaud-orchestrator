import { useToastStore, type ToastVariant } from '@/store/toast'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const variants: Record<ToastVariant, { bg: string; icon: typeof CheckCircle }> = {
  success: { bg: 'bg-[--color-accent] text-white', icon: CheckCircle },
  error: { bg: 'bg-[--color-destructive] text-white', icon: AlertCircle },
  warning: { bg: 'bg-[--color-warning] text-white', icon: AlertTriangle },
  info: { bg: 'bg-[--color-primary] text-white', icon: Info },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const config = variants[toast.variant]
        const Icon = config.icon
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-[--radius-lg] px-4 py-3 shadow-lg transition-all duration-300 ${config.bg}`}
            style={{ minWidth: 280, maxWidth: 400 }}
          >
            <Icon size={18} />
            <span className="flex-1 text-sm">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
