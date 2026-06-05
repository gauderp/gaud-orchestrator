import { describe, it, expect } from 'vitest'
import { buildAgentTurnPrompt, summarizeMessages } from '../services/prompt-builder.js'

describe('buildAgentTurnPrompt', () => {
  it('includes agent instructions', () => {
    const prompt = buildAgentTurnPrompt({
      agent: { name: 'Fiscal', instructions: '# Fiscal Agent\nKnows taxes.', skills: [] },
      conversation: { type: 'spec', summary: null },
      recentMessages: [],
      cardContext: { title: 'NFS-e Catalao', repos: ['gaud-erp-api'] },
    })
    expect(prompt).toContain('Fiscal Agent')
    expect(prompt).toContain('Knows taxes')
  })

  it('includes conversation summary when available', () => {
    const prompt = buildAgentTurnPrompt({
      agent: { name: 'Coder', instructions: 'Implement code.', skills: [] },
      conversation: { type: 'code', summary: 'We agreed to use ABRASF 2.01 for Catalao.' },
      recentMessages: [],
      cardContext: { title: 'NFS-e', repos: [] },
    })
    expect(prompt).toContain('ABRASF 2.01')
  })

  it('includes recent messages', () => {
    const prompt = buildAgentTurnPrompt({
      agent: { name: 'Reviewer', instructions: 'Review specs.', skills: [] },
      conversation: { type: 'review', summary: null },
      recentMessages: [
        { senderType: 'agent', senderId: 'fiscal', content: 'Need versaoDados 2.01' },
        { senderType: 'user', senderId: null, content: 'Agreed, use 2.01' },
      ],
      cardContext: { title: 'Review', repos: [] },
    })
    expect(prompt).toContain('versaoDados 2.01')
    expect(prompt).toContain('Agreed, use 2.01')
  })

  it('includes skill content', () => {
    const prompt = buildAgentTurnPrompt({
      agent: { name: 'Coder', instructions: 'Write code.', skills: [{ name: 'TDD', content: 'Write tests first.' }] },
      conversation: { type: 'code', summary: null },
      recentMessages: [],
      cardContext: { title: 'Task', repos: [] },
    })
    expect(prompt).toContain('Write tests first')
  })

  it('includes response format instructions', () => {
    const prompt = buildAgentTurnPrompt({
      agent: { name: 'Agent', instructions: '', skills: [] },
      conversation: { type: 'spec', summary: null },
      recentMessages: [],
      cardContext: { title: 'Task', repos: [] },
    })
    expect(prompt).toContain('@agent-name')
    expect(prompt).toContain('[QUESTION_FOR_USER]')
    expect(prompt).toContain('[ARTIFACT]')
  })
})

describe('summarizeMessages', () => {
  it('compresses messages into a summary', () => {
    const messages = [
      { senderType: 'agent' as const, senderId: 'fiscal', senderName: 'Fiscal', content: 'Catalao uses ABRASF 2.01' },
      { senderType: 'agent' as const, senderId: 'coder', senderName: 'Coder', content: 'I will use AbrasfV2NFSeEmissor' },
      { senderType: 'user' as const, senderId: null, senderName: 'User', content: 'The certificate is in the vault' },
    ]
    const summary = summarizeMessages(messages)
    expect(summary).toContain('Fiscal')
    expect(summary).toContain('ABRASF')
    expect(summary).toContain('certificate')
  })

  it('returns null for empty messages', () => {
    expect(summarizeMessages([])).toBeNull()
  })
})
