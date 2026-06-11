export type BugSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface BugReport {
  id: string
  title: string
  description: string | null
  reporterName: string | null
  reporterEmail: string | null
  source: string
  severity: BugSeverity | null
  sourceId: string | null
  externalId: string | null
  externalUrl: string | null
  cardId: string | null
  conversationId: string | null
  triageSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface BugReportAttachment {
  id: string
  bugReportId: string
  filename: string
  path: string
  fileType: string | null
  createdAt: string
}

export interface BugReportWithAttachments extends BugReport {
  attachments: BugReportAttachment[]
}
