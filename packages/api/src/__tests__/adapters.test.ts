import { describe, it, expect } from 'vitest'
import { genericAdapter } from '../intake/adapters/generic.js'
import { trelloAdapter } from '../intake/adapters/trello.js'
import type { BugSourceRow } from '../intake/types.js'
import crypto from 'crypto'

const mockSource: BugSourceRow = {
  id: 'src-1',
  name: 'Test',
  type: 'generic',
  config_json: '{}',
  webhook_secret: 'test-secret',
  enabled: 1,
}

describe('genericAdapter', () => {
  it('normalizes a valid payload', () => {
    const payload = {
      title: 'Button broken',
      description: 'Click does nothing',
      severity: 'high',
      externalId: 'ext-123',
    }
    const result = genericAdapter.normalize(payload, mockSource)
    expect(result).toEqual({
      title: 'Button broken',
      description: 'Click does nothing',
      severity: 'high',
      externalId: 'ext-123',
    })
  })

  it('returns null for payload without title', () => {
    const result = genericAdapter.normalize({ description: 'no title' }, mockSource)
    expect(result).toBeNull()
  })

  it('verify always returns true', () => {
    expect(genericAdapter.verify({} as any, mockSource)).toBe(true)
  })
})
