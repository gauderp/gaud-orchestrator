export interface Spec {
  id: string
  title: string
  content: string | null
  cardId: string
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

export interface SpecRepo {
  id: string
  specId: string
  repoPath: string
  repositoryId: string | null
  createdAt: string
}
