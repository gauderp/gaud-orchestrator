export interface Skill {
  id: string
  name: string
  description: string | null
  content: string
  source?: 'manual' | 'github' | 'upload'
  sourceUrl?: string | null
  sourceRef?: string | null
  createdAt: string
  updatedAt: string
}
