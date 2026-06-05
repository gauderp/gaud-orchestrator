import { useState } from 'react'
import type { SpecReview } from '@gaud/shared'
import { useSpecStore } from '@/store/specs'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface SpecReviewPanelProps {
  specId: string
  reviews: SpecReview[]
}

function verdictBadgeVariant(verdict: string): 'success' | 'error' | 'neutral' {
  if (verdict === 'approve') return 'success'
  if (verdict === 'reject') return 'error'
  return 'neutral'
}

function reviewerBadgeVariant(reviewerType: string): 'info' | 'neutral' {
  return reviewerType === 'user' ? 'info' : 'neutral'
}

export function SpecReviewPanel({ specId, reviews }: SpecReviewPanelProps) {
  const reviewSpec = useSpecStore((s) => s.reviewSpec)
  const [verdict, setVerdict] = useState<'approve' | 'reject' | 'comment'>('comment')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await reviewSpec(specId, {
        reviewerType: 'user',
        verdict,
        comment: comment.trim() || undefined,
      })
      setComment('')
      setVerdict('comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Review list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Reviews</h3>
        {reviews.length === 0 && (
          <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No reviews yet.</p>
        )}
        {reviews.map((review) => {
          const date = new Date(review.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric',
          })

          return (
            <div
              key={review.id}
              className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={reviewerBadgeVariant(review.reviewerType)}>
                  {review.reviewerType}
                </Badge>
                <Badge variant={verdictBadgeVariant(review.verdict)}>
                  {review.verdict}
                </Badge>
                <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{date}</span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] whitespace-pre-wrap">
                  {review.comment}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Add review form */}
      <div className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Add Review</h3>

        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as 'approve' | 'reject' | 'comment')}
          className="w-full h-9 rounded-md border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] px-3 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] cursor-pointer"
        >
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="comment">Comment</option>
        </select>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[80px] resize-y"
          placeholder="Add a comment..."
        />

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </div>
    </div>
  )
}
