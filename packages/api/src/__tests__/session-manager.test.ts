import { describe, it, expect } from 'vitest'
import { SessionManager } from '../services/session-manager.js'

describe('SessionManager', () => {
  it('respects maxConcurrent limit', () => {
    const manager = new SessionManager({ maxConcurrent: 3 })
    expect(manager.maxConcurrent).toBe(3)
    expect(manager.activeSessions).toBe(0)
    expect(manager.canSpawn()).toBe(true)
  })

  it('detects approval request in output', () => {
    const result = SessionManager.detectApprovalRequest(
      'Working on task...\n[APPROVAL_NEEDED] Which auth library?'
    )
    expect(result).toBe('Which auth library?')
  })

  it('returns null for normal output', () => {
    expect(SessionManager.detectApprovalRequest('Just working...')).toBeNull()
  })

  it('detects approval with preamble', () => {
    const result = SessionManager.detectApprovalRequest(
      'I analyzed the code.\n\n[APPROVAL_NEEDED] The config file is missing. Should I create it?'
    )
    expect(result).toContain('config file is missing')
  })
})
