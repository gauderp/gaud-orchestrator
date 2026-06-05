export type SpecStatus = 'draft' | 'review' | 'approved' | 'rejected'

export interface Spec {
  id: string
  title: string
  content: string
  status: SpecStatus
  sourceCardId: string | null
  version: number
  createdByType: 'user' | 'agent'
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface SpecReview {
  id: string
  specId: string
  reviewerType: 'user' | 'agent'
  reviewerId: string | null
  verdict: 'approve' | 'reject' | 'comment'
  comment: string | null
  createdAt: string
}
