export interface BugSource {
  id: string
  name: string
  type: string
  configJson: string
  webhookSecret: string
  enabled: boolean
  createdAt: string
}

export interface NormalizedBugIntake {
  title: string
  description: string
  externalId?: string
  externalUrl?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  reporterName?: string
  reporterEmail?: string
}
