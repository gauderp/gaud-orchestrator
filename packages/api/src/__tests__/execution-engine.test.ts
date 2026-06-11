import { describe, it, expect } from 'vitest'
import { ExecutionEngine } from '../services/execution-engine.js'

describe('ExecutionEngine', () => {
  it('buildTaskPrompt includes title and spec context', () => {
    const prompt = ExecutionEngine.buildTaskPrompt({
      title: 'Build API',
      description: 'POST /auth/login',
      branch: 'feature/etask-1-auth',
      specContent: '# Auth Spec\nImplement JWT.',
      agentInstructions: 'You are a coder.',
      agentSkills: ['TDD: Write tests first.'],
      learnings: ['Previous: Use jose library for JWT.'],
    })
    expect(prompt).toContain('Build API')
    expect(prompt).toContain('POST /auth/login')
    expect(prompt).toContain('feature/etask-1-auth')
    expect(prompt).toContain('Auth Spec')
    expect(prompt).toContain('You are a coder')
    expect(prompt).toContain('TDD')
    expect(prompt).toContain('jose library')
    expect(prompt).toContain('[APPROVAL_NEEDED]')
  })

  it('buildTaskPrompt includes attachments', () => {
    const prompt = ExecutionEngine.buildTaskPrompt({
      title: 'Test',
      description: 'desc',
      branch: 'test-branch',
      attachments: [
        { filename: 'readme.md', content: '# Hello', type: 'text' },
        { filename: 'image.png', content: '/path/to/image.png', type: 'path' },
      ],
    })
    expect(prompt).toContain('Card Attachments')
    expect(prompt).toContain('readme.md')
    expect(prompt).toContain('# Hello')
    expect(prompt).toContain('image.png')
    expect(prompt).toContain('/path/to/image.png')
  })

  it('buildTaskPrompt includes codebase analysis', () => {
    const prompt = ExecutionEngine.buildTaskPrompt({
      title: 'Test',
      description: 'desc',
      branch: 'test-branch',
      codebaseAnalysis: '## Structure\n- src/\n- tests/',
    })
    expect(prompt).toContain('Codebase Analysis')
    expect(prompt).toContain('## Structure')
  })
})
