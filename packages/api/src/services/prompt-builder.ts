interface AgentContext {
  name: string
  instructions: string | null
  skills: Array<{ name: string; content: string }>
}

interface ConversationContext {
  type: string
  summary: string | null
}

interface MessageContext {
  senderType: 'agent' | 'user' | 'system'
  senderId: string | null
  content: string
}

interface CardContext {
  title: string
  repos: string[]
  description?: string
  specPath?: string
}

interface BuildPromptOpts {
  agent: AgentContext
  conversation: ConversationContext
  recentMessages: MessageContext[]
  cardContext: CardContext
}

export function buildAgentTurnPrompt(opts: BuildPromptOpts): string {
  const sections: string[] = []

  // 1. Agent identity + instructions
  sections.push(`You are ${opts.agent.name}, participating in a collaborative ${opts.conversation.type} conversation.`)
  if (opts.agent.instructions) {
    sections.push(`## Your Knowledge\n\n${opts.agent.instructions}`)
  }

  // 2. Skills
  if (opts.agent.skills.length > 0) {
    const skillText = opts.agent.skills.map((s) => `### ${s.name}\n${s.content}`).join('\n\n')
    sections.push(`## Your Skills\n\n${skillText}`)
  }

  // 3. Card context
  sections.push(`## Task Context\n\n**Title:** ${opts.cardContext.title}`)
  if (opts.cardContext.description) {
    sections.push(`**Description:** ${opts.cardContext.description}`)
  }
  if (opts.cardContext.repos.length > 0) {
    sections.push(`**Repositories:** ${opts.cardContext.repos.join(', ')}`)
  }
  if (opts.cardContext.specPath) {
    sections.push(`**Spec:** ${opts.cardContext.specPath}`)
  }

  // 4. Conversation summary (compressed history)
  if (opts.conversation.summary) {
    sections.push(`## Conversation Summary (previous messages)\n\n${opts.conversation.summary}`)
  }

  // 5. Recent messages (raw, for immediate context)
  if (opts.recentMessages.length > 0) {
    const formatted = opts.recentMessages.map((m) => {
      const sender = m.senderType === 'user' ? 'User' : m.senderId ?? 'System'
      return `**${sender}:** ${m.content}`
    }).join('\n\n')
    sections.push(`## Recent Messages\n\n${formatted}`)
  }

  // 6. Response format instructions
  sections.push(`## How to Respond

Contribute your expertise to the conversation. You can:

- **Share knowledge or analysis** — just write your contribution
- **Ask another agent** — write @agent-name followed by your question
- **Ask the user** — write [QUESTION_FOR_USER] followed by your question. Then STOP. Do not continue.
- **Produce a final artifact** — write [ARTIFACT] followed by the complete artifact (spec, plan, code). Only do this when the team has reached consensus.

Keep your response focused and concise. One contribution per turn.`)

  return sections.join('\n\n')
}

interface SummarizeMessage {
  senderType: 'agent' | 'user' | 'system'
  senderId: string | null
  senderName: string
  content: string
}

export function summarizeMessages(messages: SummarizeMessage[]): string | null {
  if (messages.length === 0) return null

  // Simple extractive summary: take key points from each message
  const points = messages.map((m) => {
    const name = m.senderType === 'user' ? 'User' : m.senderName
    // Take first 200 chars of each message as a summary point
    const snippet = m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content
    return `- ${name}: ${snippet}`
  })

  return `Key points from earlier in the conversation:\n${points.join('\n')}`
}
