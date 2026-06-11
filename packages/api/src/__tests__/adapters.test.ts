import { describe, it, expect } from 'vitest'
import { genericAdapter } from '../intake/adapters/generic.js'
import { bugsnagAdapter } from '../intake/adapters/bugsnag.js'
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

describe('bugsnagAdapter', () => {
  const source: BugSourceRow = {
    id: 'src-2', name: 'Bugsnag Prod', type: 'bugsnag',
    config_json: '{}', webhook_secret: 'bugsnag-secret', enabled: 1,
  }

  it('normalizes a firstException trigger', () => {
    const payload = {
      trigger: { type: 'firstException' },
      error: {
        errorId: 'err-abc',
        exceptionClass: 'TypeError',
        message: 'Cannot read property x of null',
        severity: 'error',
        url: 'https://app.bugsnag.com/org/proj/errors/err-abc',
        stackTrace: [{ file: 'app.js', lineNumber: 42, method: 'handleClick' }],
        context: 'UserDashboard',
      },
      project: { name: 'my-app' },
    }
    const result = bugsnagAdapter.normalize(payload, source)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('TypeError: Cannot read property x of null')
    expect(result!.externalId).toBe('err-abc')
    expect(result!.severity).toBe('critical')
    expect(result!.description).toContain('handleClick')
  })

  it('returns null for non-error triggers', () => {
    const result = bugsnagAdapter.normalize({ trigger: { type: 'projectSpiking' }, error: {} }, source)
    expect(result).toBeNull()
  })

  it('verify returns true', () => {
    expect(bugsnagAdapter.verify({} as any, source)).toBe(true)
  })
})
