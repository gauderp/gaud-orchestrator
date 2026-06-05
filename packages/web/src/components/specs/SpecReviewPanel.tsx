import { useState } from 'react'
import type { SpecReview } from '@gaud/shared'
import { useSpecStore } from '@/store/specs'

interface SpecReviewPanelProps {
  specId: string
  reviews: SpecReview[]
}

const VERDICT_COLORS: Record<string, string> = {
  approve: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  comment: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

const REVIEWER_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  agent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reviews</h3>
        {reviews.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet.</p>
        )}
        {reviews.map((review) => {
          const verdictColor = VERDICT_COLORS[review.verdict] ?? VERDICT_COLORS['comment']!
          const reviewerColor = REVIEWER_COLORS[review.reviewerType] ?? REVIEWER_COLORS['user']!
          const date = new Date(review.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric',
          })

          return (
            <div
              key={review.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewerColor}`}>
                  {review.reviewerType}
                </span>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${verdictColor}`}>
                  {review.verdict}
                </span>
                <span className="text-xs text-gray-400">{date}</span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {review.comment}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Add review form */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Review</h3>

        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as 'approve' | 'reject' | 'comment')}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="comment">Comment</option>
        </select>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full min-h-[80px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder="Add a comment..."
        />

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
