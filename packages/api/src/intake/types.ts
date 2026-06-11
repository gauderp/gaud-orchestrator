import { FastifyRequest } from 'fastify'
import type { NormalizedBugIntake } from '@gaud/shared'

export interface BugSourceRow {
  id: string
  name: string
  type: string
  config_json: string
  webhook_secret: string
  enabled: number
}

export interface BugSourceAdapter {
  type: string
  verify(req: FastifyRequest, source: BugSourceRow): boolean
  normalize(payload: unknown, source: BugSourceRow): NormalizedBugIntake | null
}
