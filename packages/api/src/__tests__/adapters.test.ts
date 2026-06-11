import { describe, it, expect } from 'vitest'
import { genericAdapter } from '../intake/adapters/generic.js'
import { trelloAdapter } from '../intake/adapters/trello.js'
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

describe('trelloAdapter', () => {
  const source: BugSourceRow = {
    id: 'src-3', name: 'Trello Support', type: 'trello',
    config_json: JSON.stringify({ listId: 'list-bugs' }),
    webhook_secret: 'trello-api-secret', enabled: 1,
  }

  it('normalizes a createCard action on configured list', () => {
    const payload = {
      action: {
        type: 'createCard',
        data: {
          card: { id: 'card-t1', name: 'Login 500 error', desc: 'Users report 500', shortUrl: 'https://trello.com/c/abc' },
          list: { id: 'list-bugs' },
        },
      },
    }
    const result = trelloAdapter.normalize(payload, source)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Login 500 error')
    expect(result!.externalId).toBe('card-t1')
  })

  it('returns null for non-configured lists', () => {
    const payload = {
      action: { type: 'createCard', data: { card: { id: 'x', name: 'Y', desc: '' }, list: { id: 'list-other' } } },
    }
    expect(trelloAdapter.normalize(payload, source)).toBeNull()
  })

  it('returns null for non-card actions', () => {
    expect(trelloAdapter.normalize({ action: { type: 'addMemberToBoard', data: {} } }, source)).toBeNull()
  })

  it('verify checks HMAC-SHA1', () => {
    const body = JSON.stringify({ action: { type: 'createCard' } })
    const url = 'https://example.com/api/intake/bugs/src-3?token=trello-api-secret'
    const hash = crypto.createHmac('sha1', source.webhook_secret).update(body + url).digest('base64')
    const req = {
      headers: { 'x-trello-webhook': hash },
      rawBody: body,
      url: '/api/intake/bugs/src-3?token=trello-api-secret',
      hostname: 'example.com',
      protocol: 'https',
    } as any
    expect(trelloAdapter.verify(req, source)).toBe(true)
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
