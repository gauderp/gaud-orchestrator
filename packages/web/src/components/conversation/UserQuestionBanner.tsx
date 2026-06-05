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
    <div className="border-l-4 border-[--color-warning] bg-amber-50 p-4 dark:bg-amber-950/20">
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-[--color-warning]" />
        <div>
          <p className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            Agent needs your input
          </p>
          <p className="mt-1 text-sm text-[--color-ink] dark:text-[--color-ink-dark]">
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
          className="flex-1 rounded-[--radius-md] border border-[--color-border] bg-white px-3 py-2 text-sm text-[--color-ink] placeholder:text-[--color-muted] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 dark:border-[--color-border-dark] dark:bg-[--color-surface-dark] dark:text-[--color-ink-dark] dark:placeholder:text-[--color-muted-dark]"
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
