import { useState } from 'react'
import { AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface UserQuestionBannerProps {
  question: string
  onRespond: (response: string) => void
}

export function UserQuestionBanner({ question, onRespond }: UserQuestionBannerProps) {
  const [response, setResponse] = useState('')

  const handleSubmit = () => {
    if (!response.trim()) return
    onRespond(response.trim())
    setResponse('')
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.04] p-4 dark:bg-[var(--color-warning)]/[0.06]">
      <div className="flex items-start gap-2.5 mb-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Agent needs your input
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {question}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your response..."
          rows={2}
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)] dark:placeholder:text-[var(--color-muted-dark)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
        />
        <Button onClick={handleSubmit} disabled={!response.trim()}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}
