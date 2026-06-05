import type { CardType } from '@gaud/shared'

export interface DecomposedTask {
  title: string
  description: string
  type: CardType
  dependsOn: string[]  // titles of other tasks
  agent?: string       // suggested agent name/id
}

export function buildDecomposePrompt(specContent: string, availableAgents: string[]): string {
  const agentList = availableAgents.length > 0
    ? `\n\nAvailable agents to assign: ${availableAgents.join(', ')}`
    : ''

  return `You are a task decomposer. Break the following spec into atomic, implementable tasks.

## Rules

1. Each task should be implementable in a single coding session
2. Each task has a clear title, description, and type (task or bug)
3. List dependencies by task title (tasks that must complete before this one)
4. Assign an agent from the available list if one matches the task domain
5. Tasks that can be done in parallel should NOT depend on each other
6. Order tasks logically — foundational work first
${agentList}

## Spec

${specContent}

## Output Format

Respond with a JSON block:

\`\`\`json
{
  "tasks": [
    {
      "title": "Short task title",
      "description": "Detailed description of what to implement",
      "type": "task",
      "dependsOn": ["title of blocking task"],
      "agent": "agent-name or null"
    }
  ]
}
\`\`\`
`
}

export function parseDecomposition(response: string): DecomposedTask[] {
  // Extract JSON from markdown code block
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
  let parsed: { tasks: any[] }

  if (jsonMatch) {
    parsed = JSON.parse(jsonMatch[1])
  } else {
    const trimmed = response.trim()
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed)
    } else {
      throw new Error('No JSON found in decomposition response')
    }
  }

  return parsed.tasks.map((t) => ({
    title: t.title,
    description: t.description,
    type: (t.type as CardType) ?? 'task',
    dependsOn: t.dependsOn ?? [],
    agent: t.agent ?? undefined,
  }))
}
