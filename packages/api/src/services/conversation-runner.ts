import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { buildAgentTurnPrompt, summarizeMessages } from './prompt-builder.js'
import { AgentMemory } from './memory.js'
import { createEmbeddingRegistry } from './embeddings.js'
import { detectLearnings } from './learning-detector.js'

// --- Response parser ---

export interface ParsedResponse {
  type: 'content' | 'question_for_user' | 'artifact'
  content: string
  mentions: string[]
  questionForUser: string | null
  artifact: string | null
}

export function parseAgentResponse(raw: string): ParsedResponse {
  const mentions: string[] = []
  const mentionRegex = /@([\w-]+)/g
  let match: RegExpExecArray | null
  while ((match = mentionRegex.exec(raw)) !== null) {
    mentions.push(match[1]!)
  }

  // Check for [QUESTION_FOR_USER]
  const questionMatch = raw.match(/\[QUESTION_FOR_USER]\s*([\s\S]+)$/i)
  if (questionMatch) {
    const questionText = questionMatch[1]!.trim()
    const contentBefore = raw.substring(0, raw.indexOf('[QUESTION_FOR_USER]')).trim()
    return {
      type: 'question_for_user',
      content: contentBefore || questionText,
      mentions,
      questionForUser: questionText,
      artifact: null,
    }
  }

  // Check for [ARTIFACT]
  const artifactMatch = raw.match(/\[ARTIFACT]\s*([\s\S]+)$/i)
  if (artifactMatch) {
    const artifactText = artifactMatch[1]!.trim()
    const contentBefore = raw.substring(0, raw.indexOf('[ARTIFACT]')).trim()
    return {
      type: 'artifact',
      content: contentBefore || artifactText,
      mentions,
      questionForUser: null,
      artifact: artifactText,
    }
  }

  return {
    type: 'content',
    content: raw,
    mentions,
    questionForUser: null,
    artifact: null,
  }
}

// --- Agent picker ---

interface Participant {
  agentId: string
  agentName: string
}

export function pickNextAgent(
  participants: Participant[],
  mentions: string[],
  lastSenderId: string | null,
): Participant | null {
  if (participants.length === 0) return null

  // Priority 1: mentioned agent
  if (mentions.length > 0) {
    for (const mention of mentions) {
      const found = participants.find(
        (p) => p.agentId === mention || p.agentName.toLowerCase() === mention.toLowerCase(),
      )
      if (found) return found
    }
  }

  // Priority 2: round-robin (next after last sender)
  if (!lastSenderId) return participants[0] ?? null
  const lastIndex = participants.findIndex((p) => p.agentId === lastSenderId)
  const nextIndex = (lastIndex + 1) % participants.length
  return participants[nextIndex] ?? null
}

// --- Conversation runner ---

const MAX_TURNS_WITHOUT_PROGRESS = 10
const RECENT_MESSAGES_LIMIT = 10
const SUMMARY_THRESHOLD = 15 // summarize after this many messages

export interface RunTurnResult {
  message: any
  conversationStatus: 'active' | 'paused_for_user' | 'completed'
  nextAgentId: string | null
}

export async function runConversationTurn(
  db: Database.Database,
  conversationId: string,
  providerRegistry: any, // ProviderRegistry from @gaud/providers
): Promise<RunTurnResult> {
  // 1. Load conversation
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as any
  if (!conv) throw new Error('Conversation not found')
  if (conv.status !== 'active') throw new Error(`Conversation is ${conv.status}`)

  // 2. Load participants with agent details
  const participants = db.prepare(`
    SELECT cp.agent_id, a.name as agent_name, a.instructions, a.provider_id, a.model
    FROM conversation_participants cp
    JOIN agents a ON a.id = cp.agent_id
    WHERE cp.conversation_id = ?
  `).all(conversationId) as any[]

  // 3. Load messages
  const allMessages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at'
  ).all(conversationId) as any[]

  // 4. Determine last sender
  const lastAgentMsg = [...allMessages].reverse().find((m: any) => m.sender_type === 'agent')
  const lastSenderId = lastAgentMsg?.sender_id ?? null

  // 5. Determine mentions from last message
  const lastMsg = allMessages[allMessages.length - 1]
  const lastMentions = lastMsg ? (parseAgentResponse(lastMsg.content).mentions) : []

  // 6. Pick next agent
  const nextAgent = pickNextAgent(
    participants.map((p: any) => ({ agentId: p.agent_id, agentName: p.agent_name })),
    lastMentions,
    lastSenderId,
  )
  if (!nextAgent) throw new Error('No agents available')

  const agentRow = participants.find((p: any) => p.agent_id === nextAgent.agentId)

  // 7. Load agent skills
  const skills = db.prepare(`
    SELECT s.name, s.content FROM skills s
    JOIN agent_skills ags ON ags.skill_id = s.id
    WHERE ags.agent_id = ?
  `).all(nextAgent.agentId) as any[]

  // 8. Load card context
  let cardContext = { title: 'General', repos: [] as string[], description: undefined as string | undefined }
  if (conv.card_id) {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(conv.card_id) as any
    if (card) {
      const repos = db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(conv.card_id) as any[]
      cardContext = {
        title: card.title,
        description: card.description,
        repos: repos.map((r: any) => r.repo_path),
      }
    }
  }

  // 9. Maybe update summary (if messages exceed threshold)
  let summary = conv.summary
  if (allMessages.length > SUMMARY_THRESHOLD && allMessages.length % 5 === 0) {
    const olderMessages = allMessages.slice(0, -RECENT_MESSAGES_LIMIT).map((m: any) => ({
      senderType: m.sender_type,
      senderId: m.sender_id,
      senderName: m.sender_type === 'user' ? 'User' : (participants.find((p: any) => p.agent_id === m.sender_id)?.agent_name ?? 'Agent'),
      content: m.content,
    }))
    summary = summarizeMessages(olderMessages)
    if (summary) {
      db.prepare('UPDATE conversations SET summary = ?, updated_at = datetime("now") WHERE id = ?')
        .run(summary, conversationId)
    }
  }

  // 10. Build recent messages list
  const recentMessages = allMessages.slice(-RECENT_MESSAGES_LIMIT).map((m: any) => ({
    senderType: m.sender_type,
    senderId: m.sender_id,
    content: m.content,
  }))

  // 10.2. Initialize memory
  const embeddingRegistry = createEmbeddingRegistry()
  const agentMemory = new AgentMemory(db, embeddingRegistry)

  // 10.2b. Session lifecycle — start session if not already active
  const existingSession = db.prepare(
    'SELECT id FROM memory_sessions WHERE conversation_id = ? AND ended_at IS NULL'
  ).get(conversationId) as any

  if (!existingSession) {
    agentMemory.startSession(nextAgent.agentId, conversationId)
  }

  // 10.3. Codebase analysis for spec/research/plan conversations
  let codebaseAnalysis: string | undefined
  if (['spec', 'research', 'plan'].includes(conv.type) && cardContext.repos.length > 0) {
    try {
      const { analyzeCodebase } = await import('./codebase-analyzer.js')
      const analysis = await analyzeCodebase(cardContext.repos[0]!)
      codebaseAnalysis = analysis.markdown
    } catch { /* analysis optional */ }
  }

  // 10.5. Query relevant memories for this agent (Phase 5)
  const queryText = [
    cardContext.title,
    ...recentMessages.slice(-3).map((m) => m.content),
  ].join(' ').substring(0, 500)
  const relevantMemories = await agentMemory.search(queryText, {
    agentId: nextAgent.agentId,
    limit: 5,
    minSimilarity: 0.4,
  })

  // 11. Build prompt
  const prompt = buildAgentTurnPrompt({
    agent: {
      name: agentRow.agent_name,
      instructions: agentRow.instructions,
      skills: skills.map((s: any) => ({ name: s.name, content: s.content })),
    },
    conversation: { type: conv.type, summary },
    recentMessages,
    cardContext,
    relevantMemories: relevantMemories.map((m) => ({
      type: m.type,
      content: m.content,
      similarity: m.similarity,
    })),
    codebaseAnalysis,
  })

  // 11. Call provider
  const provider = providerRegistry.get(agentRow.provider_id ?? 'claude-cli')
  if (!provider) throw new Error(`Provider not found: ${agentRow.provider_id}`)

  let responseText = ''
  const session = await provider.spawn({
    prompt,
    cwd: cardContext.repos[0] ?? process.cwd(),
    model: agentRow.model ?? undefined,
  })

  // Collect output
  await new Promise<void>((resolve) => {
    provider.onOutput(session.id, (event: any) => {
      if (event.type === 'stdout') responseText += event.content
    })
    const check = setInterval(() => {
      if (responseText.length > 0) {
        clearInterval(check)
        resolve()
      }
    }, 500)
    setTimeout(() => { clearInterval(check); resolve() }, 120_000)
  })

  if (!responseText.trim()) {
    responseText = '[No response from agent]'
  }

  // 12. Parse response
  const parsed = parseAgentResponse(responseText)

  // 13. Store message
  const messageId = randomUUID()
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content, message_type, mentions)
    VALUES (?, ?, 'agent', ?, ?, ?, ?)
  `).run(
    messageId, conversationId, nextAgent.agentId,
    parsed.content + (parsed.artifact ? `\n\n[ARTIFACT]\n${parsed.artifact}` : ''),
    parsed.type === 'question_for_user' ? 'question_for_user' : parsed.type === 'artifact' ? 'artifact' : 'content',
    parsed.mentions.length > 0 ? JSON.stringify(parsed.mentions) : null,
  )

  const message = toCamelCase(db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any)

  // 13.5. Detect and store learnings (Phase 5)
  const learningMessages = allMessages.slice(-5).map((m: any) => ({
    senderType: m.sender_type as 'agent' | 'user' | 'system',
    senderId: m.sender_id as string | null,
    content: m.content as string,
  }))
  // Include the new agent response
  learningMessages.push({
    senderType: 'agent',
    senderId: nextAgent.agentId,
    content: responseText,
  })
  const learnings = detectLearnings(learningMessages, nextAgent.agentId)
  for (const learning of learnings) {
    await agentMemory.store(learning)
    broadcast('memory:learning', {
      agentId: learning.agentId,
      type: learning.type,
      content: learning.content,
    })
  }

  // 14. Update conversation status
  let newStatus: 'active' | 'paused_for_user' | 'completed' = 'active'
  if (parsed.type === 'question_for_user') {
    newStatus = 'paused_for_user'
    db.prepare('UPDATE conversations SET status = ?, updated_at = datetime("now") WHERE id = ?')
      .run('paused_for_user', conversationId)
  } else if (parsed.type === 'artifact') {
    newStatus = 'completed'
    db.prepare('UPDATE conversations SET status = ?, updated_at = datetime("now") WHERE id = ?')
      .run('completed', conversationId)
    // End memory session
    const session = db.prepare(
      'SELECT id FROM memory_sessions WHERE conversation_id = ? AND ended_at IS NULL'
    ).get(conversationId) as any
    if (session) {
      agentMemory.endSession(session.id)
    }
  }

  // 15. Broadcast
  broadcast('conversation:message', { conversationId, message })
  if (newStatus !== 'active') {
    broadcast('conversation:status', { conversationId, status: newStatus })
  }
  if (parsed.type === 'question_for_user') {
    broadcast('conversation:question', { conversationId, question: parsed.questionForUser })
  }
  if (parsed.type === 'artifact') {
    broadcast('conversation:artifact', { conversationId, artifact: parsed.artifact })
  }

  // 16. Determine next agent (for auto-continue)
  const nextMentions = parsed.mentions
  const nextPick = parsed.type === 'content'
    ? pickNextAgent(
        participants.map((p: any) => ({ agentId: p.agent_id, agentName: p.agent_name })),
        nextMentions,
        nextAgent.agentId,
      )
    : null

  return {
    message,
    conversationStatus: newStatus,
    nextAgentId: nextPick?.agentId ?? null,
  }
}
