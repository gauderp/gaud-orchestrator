import { describe, it, expect } from 'vitest'
import { parseAgentResponse, pickNextAgent } from '../services/conversation-runner.js'

describe('parseAgentResponse', () => {
  it('detects plain content', () => {
    const result = parseAgentResponse('Catalao uses ABRASF 2.01 with async-only flow.')
    expect(result.type).toBe('content')
    expect(result.content).toContain('ABRASF 2.01')
    expect(result.mentions).toEqual([])
    expect(result.questionForUser).toBeNull()
    expect(result.artifact).toBeNull()
  })

  it('detects agent mention', () => {
    const result = parseAgentResponse('@gaud-fiscal which versaoDados should we use?')
    expect(result.type).toBe('content')
    expect(result.mentions).toContain('gaud-fiscal')
  })

  it('detects multiple mentions', () => {
    const result = parseAgentResponse('@fiscal and @coder need to agree on the approach.')
    expect(result.mentions).toContain('fiscal')
    expect(result.mentions).toContain('coder')
  })

  it('detects question for user', () => {
    const result = parseAgentResponse('Some analysis here.\n\n[QUESTION_FOR_USER] Is the A1 certificate configured?')
    expect(result.type).toBe('question_for_user')
    expect(result.questionForUser).toBe('Is the A1 certificate configured?')
    expect(result.content).toContain('Some analysis')
  })

  it('detects artifact', () => {
    const result = parseAgentResponse('[ARTIFACT]\n# NFS-e Catalao Spec\n\n## Overview\nBuild NFS-e integration.')
    expect(result.type).toBe('artifact')
    expect(result.artifact).toContain('NFS-e Catalao Spec')
  })

  it('detects artifact with preamble', () => {
    const result = parseAgentResponse('Based on our discussion, here is the spec:\n\n[ARTIFACT]\n# Spec\nContent here.')
    expect(result.type).toBe('artifact')
    expect(result.content).toContain('Based on our discussion')
    expect(result.artifact).toContain('Spec')
  })
})

describe('pickNextAgent', () => {
  const participants = [
    { agentId: 'fiscal', agentName: 'Fiscal' },
    { agentId: 'coder', agentName: 'Coder' },
    { agentId: 'reviewer', agentName: 'Reviewer' },
  ]

  it('picks mentioned agent first', () => {
    const next = pickNextAgent(participants, ['fiscal'], 'coder')
    expect(next?.agentId).toBe('fiscal')
  })

  it('round-robins when no mentions', () => {
    const next = pickNextAgent(participants, [], 'fiscal')
    expect(next?.agentId).toBe('coder') // next after fiscal
  })

  it('wraps around at end of list', () => {
    const next = pickNextAgent(participants, [], 'reviewer')
    expect(next?.agentId).toBe('fiscal') // wraps to first
  })

  it('returns first agent when no last sender', () => {
    const next = pickNextAgent(participants, [], null)
    expect(next?.agentId).toBe('fiscal')
  })
})
