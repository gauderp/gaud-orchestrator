import { describe, it, expect } from 'vitest'
import { ExecutionEngine } from '../services/execution-engine.js'

describe('ExecutionEngine', () => {
  it('getExecutableTasks returns tasks with all deps done', () => {
    const tasks = [
      { id: 't1', status: 'done', dependsOn: '[]' },
      { id: 't2', status: 'pending', dependsOn: '["t1"]' },
      { id: 't3', status: 'pending', dependsOn: '["t2"]' },
    ]
    const executable = ExecutionEngine.getExecutableTasks(tasks as any)
    expect(executable.map(t => t.id)).toEqual(['t2'])
  })

  it('getExecutableTasks returns multiple parallel tasks', () => {
    const tasks = [
      { id: 't1', status: 'done', dependsOn: '[]' },
      { id: 't2', status: 'pending', dependsOn: '["t1"]' },
      { id: 't3', status: 'pending', dependsOn: '["t1"]' },
    ]
    const executable = ExecutionEngine.getExecutableTasks(tasks as any)
    expect(executable).toHaveLength(2)
  })

  it('getExecutableTasks returns tasks with no deps when none are done', () => {
    const tasks = [
      { id: 't1', status: 'pending', dependsOn: '[]' },
      { id: 't2', status: 'pending', dependsOn: '["t1"]' },
    ]
    const executable = ExecutionEngine.getExecutableTasks(tasks as any)
    expect(executable.map(t => t.id)).toEqual(['t1'])
  })

  it('getExecutableTasks skips running tasks', () => {
    const tasks = [
      { id: 't1', status: 'running', dependsOn: '[]' },
      { id: 't2', status: 'pending', dependsOn: '[]' },
    ]
    const executable = ExecutionEngine.getExecutableTasks(tasks as any)
    expect(executable.map(t => t.id)).toEqual(['t2'])
  })

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
})
