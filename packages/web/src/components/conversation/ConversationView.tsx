import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, Pause, Play, Zap, ZapOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MessageBubble } from './MessageBubble'
import { UserQuestionBanner } from './UserQuestionBanner'
import { ArtifactBlock } from './ArtifactBlock'
import { OptionButtons, stripOptions } from './OptionButtons'
import { useConversationStore } from '@/store/conversations'
import type { ConversationWithMessages } from '@gaud/shared'

interface ConversationViewProps {
  conversation: ConversationWithMessages
}

const AGENT_COLORS = [
  '#059669', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#0891B2',
]

export function ConversationView({ conversation }: ConversationViewProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const { sendMessage, triggerNextTurn, pauseConversation, resumeConversation, autoRun, setAutoRun } = useConversationStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll unless user scrolled up
  useEffect(() => {
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation.messages.length, userScrolled])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setUserScrolled(!atBottom)
  }, [])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(conversation.id, input.trim())
    setInput('')
    setUserScrolled(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // Auto-grow textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const lastQuestion = conversation.status === 'paused_for_user'
    ? [...conversation.messages].reverse().find((m) => m.messageType === 'question_for_user')
    : null

  // Build agent name/color maps
  const agentNames: Record<string, string> = {}
  const agentColors: Record<string, string> = {}
  conversation.participants.forEach((p, i) => {
    agentNames[p.agentId] = p.agentName ?? p.agentId
    agentColors[p.agentId] = AGENT_COLORS[i % AGENT_COLORS.length]!
  })

  const statusBadge = {
    active: { variant: 'info' as const, label: 'Active' },
    paused_for_user: { variant: 'warning' as const, label: 'Waiting for you' },
    completed: { variant: 'success' as const, label: 'Completed' },
  }[conversation.status]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5 dark:border-[var(--color-border-dark)]">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {conversation.type.charAt(0).toUpperCase() + conversation.type.slice(1)}
          </h3>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Participant avatars */}
          <div className="flex -space-x-1">
            {conversation.participants.map((p, i) => (
              <div
                key={p.agentId}
                title={agentNames[p.agentId] ?? p.agentId}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-[var(--color-bg-dark)]"
                style={{ backgroundColor: agentColors[p.agentId] }}
              >
                {(agentNames[p.agentId] ?? '?').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Auto-run toggle */}
          <button
            onClick={() => setAutoRun(!autoRun)}
            title={autoRun ? 'Auto-run ON' : 'Auto-run OFF'}
            className={`rounded-[var(--radius-md)] p-1.5 ${
              autoRun
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]'
            } hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)] cursor-pointer`}
          >
            {autoRun ? <Zap size={16} /> : <ZapOff size={16} />}
          </button>

          {/* Pause/Resume */}
          {conversation.status === 'active' && (
            <button
              onClick={() => pauseConversation(conversation.id)}
              title="Pause"
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] cursor-pointer"
            >
              <Pause size={16} />
            </button>
          )}
          {conversation.status === 'paused_for_user' && (
            <button
              onClick={() => resumeConversation(conversation.id)}
              title="Resume"
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)] cursor-pointer"
            >
              <Play size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {conversation.messages.map((msg, idx) => {
          const isLastMessage = idx === conversation.messages.length - 1
          const hasOptions = msg.content.includes('[OPTIONS]')
          const isAgentMsg = msg.senderType === 'agent'
          const displayContent = stripOptions(msg.content)
          const artifactMatch = displayContent.match(/\[ARTIFACT]\s*([\s\S]+)$/i)
          return (
            <div key={msg.id}>
              <MessageBubble
                message={{ ...msg, content: displayContent }}
                agentName={msg.senderId ? agentNames[msg.senderId] : undefined}
                agentColor={msg.senderId ? agentColors[msg.senderId] : undefined}
              />
              {isAgentMsg && hasOptions && isLastMessage && conversation.status !== 'completed' && (
                <div className="px-4 pb-2">
                  <OptionButtons
                    content={msg.content}
                    onSelect={(option) => {
                      sendMessage(conversation.id, option)
                      setUserScrolled(false)
                    }}
                  />
                </div>
              )}
              {artifactMatch && (
                <ArtifactBlock artifact={(artifactMatch[1] ?? '').trim()} />
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
        <div className="border-t border-[var(--color-border)] px-4 py-3 dark:border-[var(--color-border-dark)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)] dark:placeholder:text-[var(--color-muted-dark)]"
              style={{ maxHeight: '120px' }}
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
