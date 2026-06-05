import type { Message } from '@gaud/shared'
import { Bot, User } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  agentName?: string
}

export function MessageBubble({ message, agentName }: MessageBubbleProps) {
  const isUser = message.senderType === 'user'
  const isSystem = message.senderType === 'system'
  const displayName = isUser ? 'You' : isSystem ? 'System' : agentName ?? message.senderId ?? 'Agent'
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex gap-3 px-4 py-3 ${!isUser ? 'bg-[--color-surface] dark:bg-[--color-surface-dark]' : ''}`}>
      {/* Avatar */}
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        isUser
          ? 'bg-[--color-primary] text-white'
          : isSystem
            ? 'bg-[--color-border] dark:bg-[--color-border-dark] text-[--color-muted] dark:text-[--color-muted-dark]'
            : 'bg-[--color-accent] text-white'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {displayName}
          </span>
          <span className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
            {time}
          </span>
        </div>
        <div className={`mt-1 text-sm whitespace-pre-wrap ${
          isSystem
            ? 'italic text-[--color-muted] dark:text-[--color-muted-dark]'
            : 'text-[--color-ink] dark:text-[--color-ink-dark]'
        }`}>
          {message.content}
        </div>
      </div>
    </div>
  )
}
