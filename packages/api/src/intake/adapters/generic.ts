import type { BugSourceAdapter, BugSourceRow } from '../types.js'
import type { NormalizedBugIntake } from '@gaud/shared'

export const genericAdapter: BugSourceAdapter = {
  type: 'generic',

  verify(_req: unknown, _source: BugSourceRow) {
    return true
  },

  normalize(payload: unknown, _source: BugSourceRow): NormalizedBugIntake | null {
    const p = payload as Record<string, unknown>
    if (!p || typeof p.title !== 'string' || !p.title.trim()) return null

    return {
      title: p.title as string,
      description: (p.description as string) || '',
      externalId: p.externalId as string | undefined,
      externalUrl: p.externalUrl as string | undefined,
      severity: ['critical', 'high', 'medium', 'low'].includes(p.severity as string)
        ? (p.severity as NormalizedBugIntake['severity'])
        : undefined,
      reporterName: p.reporterName as string | undefined,
      reporterEmail: p.reporterEmail as string | undefined,
    }
  },
}
