export type BugReportStatus = 'new' | 'triaging' | 'needs_info' | 'triaged' | 'rejected'
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low'
export type BugSource = 'ui' | 'slack' | 'mcp'

export interface BugReport {
  id: string
  title: string
  description: string
  reporterName: string | null
  reporterEmail: string | null
  source: BugSource
  status: BugReportStatus
  severity: BugSeverity | null
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
