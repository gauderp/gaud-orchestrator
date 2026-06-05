import { useEffect, useRef, useState } from 'react'
import { Send, Pause, Play, Zap, ZapOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MessageBubble } from './MessageBubble'
import { UserQuestionBanner } from './UserQuestionBanner'
import { ArtifactBlock } from './ArtifactBlock'
import { useConversationStore } from '@/store/conversations'
import type { ConversationWithMessages } from '@gaud/shared'

interface ConversationViewProps {
  conversation: ConversationWithMessages
}

export function ConversationView({ conversation }: ConversationViewProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { sendMessage, triggerNextTurn, pauseConversation, resumeConversation, autoRun, setAutoRun } = useConversationStore()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.messages.length])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(conversation.id, input.trim())
    setInput('')
  }

  // Find the last question_for_user message
  const lastQuestion = conversation.status === 'paused_for_user'
    ? [...conversation.messages].reverse().find((m) => m.messageType === 'question_for_user')
    : null

  // Build agent name map from participants
  const agentNames: Record<string, string> = {}
  for (const p of conversation.participants) {
    agentNames[p.agentId] = p.agentId
  }

  const statusBadge = {
    active: { variant: 'info' as const, label: 'Active' },
    paused_for_user: { variant: 'warning' as const, label: 'Waiting for you' },
    completed: { variant: 'success' as const, label: 'Completed' },
  }[conversation.status]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3 dark:border-[--color-border-dark]">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {conversation.type.charAt(0).toUpperCase() + conversation.type.slice(1)} Conversation
          </h3>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Participants */}
          <div className="flex -space-x-1">
            {conversation.participants.map((p) => (
              <div
                key={p.agentId}
                title={agentNames[p.agentId]}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[--color-accent] text-[10px] font-bold text-white ring-2 ring-white dark:ring-[--color-bg-dark]"
              >
                {(agentNames[p.agentId] ?? '?').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Auto-run toggle */}
          <button
            onClick={() => setAutoRun(!autoRun)}
            title={autoRun ? 'Auto-run ON' : 'Auto-run OFF'}
            className={`rounded-[--radius-md] p-1.5 ${
              autoRun
                ? 'text-[--color-primary]'
                : 'text-[--color-muted] dark:text-[--color-muted-dark]'
            } hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark]`}
          >
            {autoRun ? <Zap size={16} /> : <ZapOff size={16} />}
          </button>

          {/* Pause/Resume */}
          {conversation.status === 'active' && (
            <button
              onClick={() => pauseConversation(conversation.id)}
              title="Pause"
              className="rounded-[--radius-md] p-1.5 text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]"
            >
              <Pause size={16} />
            </button>
          )}
          {conversation.status === 'paused_for_user' && (
            <button
              onClick={() => resumeConversation(conversation.id)}
              title="Resume"
              className="rounded-[--radius-md] p-1.5 text-[--color-primary] hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark]"
            >
              <Play size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {conversation.messages.map((msg) => {
          // Check if this message contains an artifact
          const artifactMatch = msg.content.match(/\[ARTIFACT]\s*([\s\S]+)$/i)

          return (
            <div key={msg.id}>
              <MessageBubble
                message={msg}
                agentName={msg.senderId ? agentNames[msg.senderId] : undefined}
              />
              {artifactMatch && (
                <div className="px-4 pb-3">
                  <ArtifactBlock artifact={(artifactMatch[1] ?? '').trim()} />
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Question banner (when paused) */}
      {lastQuestion && conversation.status === 'paused_for_user' && (
        <UserQuestionBanner
          question={lastQuestion.content}
          onRespond={(response) => sendMessage(conversation.id, response)}
        />
      )}

      {/* Input bar */}
      {conversation.status !== 'completed' && (
        <div className="border-t border-[--color-border] p-4 dark:border-[--color-border-dark]">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-[--radius-md] border border-[--color-border] bg-white px-3 py-2 text-sm text-[--color-ink] placeholder:text-[--color-muted] focus:border-[--color-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/20 dark:border-[--color-border-dark] dark:bg-[--color-surface-dark] dark:text-[--color-ink-dark] dark:placeholder:text-[--color-muted-dark]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button onClick={handleSend} disabled={!input.trim()}>
              <Send size={14} />
            </Button>
            {!autoRun && conversation.status === 'active' && (
              <Button variant="secondary" onClick={() => triggerNextTurn(conversation.id)} title="Trigger next agent turn">
                <Play size={14} />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
