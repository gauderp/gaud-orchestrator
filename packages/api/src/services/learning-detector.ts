import type { MemoryType } from '@gaud/shared'

interface MessageInput {
  senderType: 'agent' | 'user' | 'system'
  senderId: string | null
  content: string
}

export interface DetectedLearning {
  agentId: string
  type: MemoryType
  content: string
  metadata: Record<string, unknown>
  tags: string[]
}

const CORRECTION_SIGNALS = [
  'no,', 'not', "don't", 'wrong', 'incorrect', 'actually', 'instead',
  'should be', 'must be', 'correction:',
  'nao', 'não', 'errado', 'correto é', 'na verdade',
]

const PREFERENCE_SIGNALS = [
  'always use', 'never use', 'always', 'never', 'prefer', "don't use", 'avoid',
  'sempre use', 'nunca use', 'sempre', 'nunca', 'prefira', 'evite', 'utilize',
]

export function detectLearnings(messages: MessageInput[], targetAgentId: string): DetectedLearning[] {
  const learnings: DetectedLearning[] = []

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i]!
    const previous = messages[i - 1]!

    // Pattern: agent says X, user corrects
    if (
      current.senderType === 'user' &&
      previous.senderType === 'agent' &&
      previous.senderId === targetAgentId
    ) {
      const lowerContent = current.content.toLowerCase()

      const isCorrection = CORRECTION_SIGNALS.some((signal) => lowerContent.includes(signal))
      if (isCorrection) {
        learnings.push({
          agentId: targetAgentId,
          type: 'error_correction',
          content: `Agent said: "${previous.content.substring(0, 100)}". User corrected: "${current.content}"`,
          metadata: { originalStatement: previous.content, correction: current.content },
          tags: extractTags(current.content),
        })
      }

      const isPreference = PREFERENCE_SIGNALS.some((signal) => lowerContent.includes(signal))
      if (isPreference && !isCorrection) {
        learnings.push({
          agentId: targetAgentId,
          type: 'user_preference',
          content: current.content,
          metadata: { context: previous.content.substring(0, 100) },
          tags: extractTags(current.content),
        })
      }
    }

    // Pattern: artifact produced = success
    if (current.senderType === 'agent' && current.content.includes('[ARTIFACT]')) {
      learnings.push({
        agentId: current.senderId ?? targetAgentId,
        type: 'pattern_success',
        content: `Successfully produced artifact after ${i} messages of collaboration`,
        metadata: { messageCount: i, artifactPreview: current.content.substring(0, 200) },
        tags: ['artifact', 'success'],
      })
    }
  }

  return learnings
}

function extractTags(text: string): string[] {
  const words = text.split(/\s+/)
  return words
    .filter((w) => (w.length > 3 && /^[A-Z]/.test(w)) || w.includes('-') || /\d/.test(w))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length > 2)
    .slice(0, 5)
}
