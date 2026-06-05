import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ExecutionGap } from '@gaud/shared'

interface Props {
  gaps: ExecutionGap[]
  onResolve: (gapId: string, response: string) => void
}

export function ExecutionGaps({ gaps, onResolve }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>({})

  if (gaps.length === 0) {
    return <p className="text-sm text-[--color-muted] dark:text-[--color-muted-dark]">No gaps.</p>
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap) => {
        const isPending = gap.status === 'pending'
        return (
          <div
            key={gap.id}
            className={`rounded-[--radius-lg] border p-4 ${
              isPending
                ? 'border-[--color-warning] bg-amber-50 dark:bg-amber-950/20'
                : 'border-[--color-accent] bg-emerald-50 dark:bg-emerald-950/20'
            }`}
          >
            <div className="mb-2 flex items-start gap-2">
              {isPending ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[--color-warning]" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[--color-accent]" />
              )}
              <p className="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                {gap.question}
              </p>
            </div>
            {gap.suggestion && (
              <p className="mb-2 ml-6 text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
                Suggestion: {gap.suggestion}
              </p>
            )}
            {isPending ? (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Your response..."
                  value={responses[gap.id] ?? ''}
                  onChange={(e) => setResponses((r) => ({ ...r, [gap.id]: e.target.value }))}
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const text = responses[gap.id]?.trim()
                    if (text) onResolve(gap.id, text)
                  }}
                  disabled={!responses[gap.id]?.trim()}
                >
                  Submit
                </Button>
              </div>
            ) : (
              <p className="ml-6 text-sm text-[--color-ink] dark:text-[--color-ink-dark]">
                {gap.response}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
