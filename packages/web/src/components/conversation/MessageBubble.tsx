import type { Message } from '@gaud/shared'
import { Bot, User } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  agentName?: string
  agentColor?: string
}

export function MessageBubble({ message, agentName, agentColor }: MessageBubbleProps) {
  const isUser = message.senderType === 'user'
  const isSystem = message.senderType === 'system'
  const displayName = isUser ? 'You' : isSystem ? 'System' : agentName ?? message.senderId ?? 'Agent'
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isSystem) {
    return (
      <div className="px-4 py-2 text-center">
        <span className="text-xs italic text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Avatar */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5`}
        style={{ backgroundColor: isUser ? 'var(--color-primary)' : agentColor ?? 'var(--color-accent)' }}
      >
        {isUser ? <User size={12} /> : (agentName ?? 'A').charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {displayName}
          </span>
          <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            {time}
          </span>
        </div>
        <div className="mt-0.5 text-sm whitespace-pre-wrap text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {message.content}
        </div>
      </div>
    </div>
  )
}
