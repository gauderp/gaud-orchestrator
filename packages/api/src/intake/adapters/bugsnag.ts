import type { BugSourceAdapter, BugSourceRow } from '../types.js'
import type { NormalizedBugIntake } from '@gaud/shared'

const SEVERITY_MAP: Record<string, NormalizedBugIntake['severity']> = {
  error: 'critical',
  warning: 'high',
  info: 'medium',
}

const RELEVANT_TRIGGERS = new Set(['firstException', 'reopened', 'exception'])

export const bugsnagAdapter: BugSourceAdapter = {
  type: 'bugsnag',

  verify(_req: unknown, _source: BugSourceRow) {
    return true
  },

  normalize(payload: unknown, _source: BugSourceRow): NormalizedBugIntake | null {
    const p = payload as any
    if (!p?.trigger?.type || !RELEVANT_TRIGGERS.has(p.trigger.type)) return null
    if (!p?.error) return null

    const error = p.error
    const title = [error.exceptionClass, error.message].filter(Boolean).join(': ')
    if (!title) return null

    const descParts: string[] = []
    if (p.project?.name) descParts.push(`**Project:** ${p.project.name}`)
    if (error.context) descParts.push(`**Context:** ${error.context}`)
    if (error.stackTrace?.length) {
      const top = error.stackTrace.slice(0, 5)
      const formatted = top
        .map(
          (f: any) => `  ${f.method || '<anonymous>'} (${f.file}:${f.lineNumber})`
        )
        .join('\n')
      descParts.push(`**Stack trace:**\n\`\`\`\n${formatted}\n\`\`\``)
    }
    if (error.url) descParts.push(`**Bugsnag:** ${error.url}`)

    return {
      title,
      description: descParts.join('\n\n'),
      externalId: error.errorId || undefined,
      externalUrl: error.url || undefined,
      severity: SEVERITY_MAP[error.severity] || 'medium',
    }
  },
}
