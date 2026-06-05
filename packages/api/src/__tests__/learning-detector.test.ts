import { detectLearnings } from '../services/learning-detector.js'

describe('detectLearnings', () => {
  it('detects user correction after agent statement', () => {
    const messages = [
      { senderType: 'agent' as const, senderId: 'fiscal', content: 'Catalao uses versaoDados 2.04' },
      { senderType: 'user' as const, senderId: null, content: 'No, Catalao uses 2.01, not 2.04' },
    ]
    const learnings = detectLearnings(messages, 'fiscal')
    expect(learnings).toHaveLength(1)
    expect(learnings[0]!.type).toBe('error_correction')
    expect(learnings[0]!.content).toContain('2.01')
    expect(learnings[0]!.agentId).toBe('fiscal')
  })

  it('detects user preference', () => {
    const messages = [
      { senderType: 'agent' as const, senderId: 'coder', content: 'I will use ThemaRpsXmlBuilder' },
      { senderType: 'user' as const, senderId: null, content: 'Always use AbrasfV2NFSeEmissor for ABRASF municipalities' },
    ]
    const learnings = detectLearnings(messages, 'coder')
    expect(learnings.length).toBeGreaterThanOrEqual(1)
    expect(learnings.some((l) => l.type === 'user_preference')).toBe(true)
  })

  it('returns empty for normal conversation', () => {
    const messages = [
      { senderType: 'agent' as const, senderId: 'fiscal', content: 'The endpoint is HTTP on port 80' },
      { senderType: 'agent' as const, senderId: 'coder', content: 'Got it, I will configure HTTP' },
    ]
    const learnings = detectLearnings(messages, 'coder')
    expect(learnings).toHaveLength(0)
  })

  it('detects pattern success when artifact produced', () => {
    const messages = [
      { senderType: 'agent' as const, senderId: 'fiscal', content: 'Catalao is ABRASF 2.01, async only' },
      { senderType: 'agent' as const, senderId: 'coder', content: '[ARTIFACT]\n# NFS-e Catalao Spec\nContent...' },
    ]
    const learnings = detectLearnings(messages, 'coder')
    expect(learnings.some((l) => l.type === 'pattern_success')).toBe(true)
  })
})
