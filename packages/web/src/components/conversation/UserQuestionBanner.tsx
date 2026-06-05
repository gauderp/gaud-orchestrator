import { useState } from 'react'
import { Send } from 'lucide-react'
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
    <div className="mx-4 mb-3 border-l-2 border-[var(--color-warning)] bg-[var(--color-warning)]/[0.06] rounded-r-[var(--radius-md)] p-3 dark:bg-[var(--color-warning)]/[0.08]">
      <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-1">
        Agent needs your input
      </p>
      <p className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-3">
        {question}
      </p>
      <div className="flex gap-2">
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your response..."
          rows={1}
          className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)] dark:placeholder:text-[var(--color-muted-dark)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
        />
        <Button size="sm" onClick={handleSubmit} disabled={!response.trim()}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}
