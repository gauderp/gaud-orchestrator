import { describe, it, expect } from 'vitest'
import { parseDecomposition, buildDecomposePrompt } from '../services/spec-decomposer.js'

describe('buildDecomposePrompt', () => {
  it('includes spec content', () => {
    const prompt = buildDecomposePrompt('# My Spec\n\nBuild an API.', ['gaud-fiscal', 'coder'])
    expect(prompt).toContain('My Spec')
    expect(prompt).toContain('Build an API')
  })

  it('includes available agents', () => {
    const prompt = buildDecomposePrompt('# Spec', ['fiscal', 'coder'])
    expect(prompt).toContain('fiscal')
    expect(prompt).toContain('coder')
  })

  it('requests JSON output', () => {
    const prompt = buildDecomposePrompt('# Spec', [])
    expect(prompt).toContain('```json')
  })
})

describe('parseDecomposition', () => {
  it('extracts tasks from JSON response', () => {
    const response = `Here are the tasks:
\`\`\`json
{
  "tasks": [
    {"title": "Build API endpoint", "description": "POST /auth/login", "type": "task", "dependsOn": [], "agent": "coder"},
    {"title": "Build login page", "description": "React login form", "type": "task", "dependsOn": ["Build API endpoint"], "agent": "coder"}
  ]
}
\`\`\``
    const tasks = parseDecomposition(response)
    expect(tasks).toHaveLength(2)
    expect(tasks[0].title).toBe('Build API endpoint')
    expect(tasks[1].dependsOn).toContain('Build API endpoint')
  })

  it('handles raw JSON without markdown fence', () => {
    const response = '{"tasks": [{"title": "A", "description": "B", "type": "task", "dependsOn": []}]}'
    const tasks = parseDecomposition(response)
    expect(tasks).toHaveLength(1)
  })

  it('throws on invalid response', () => {
    expect(() => parseDecomposition('no json here')).toThrow()
  })

  it('defaults type to task when missing', () => {
    const response = '{"tasks": [{"title": "A", "description": "B", "dependsOn": []}]}'
    const tasks = parseDecomposition(response)
    expect(tasks[0].type).toBe('task')
  })
})
