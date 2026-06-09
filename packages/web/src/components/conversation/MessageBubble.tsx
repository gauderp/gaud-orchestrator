import Markdown from 'react-markdown'
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
          {message.content.length > 120 ? 'Bug report context loaded' : message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5"
        style={{ backgroundColor: isUser ? 'var(--color-primary)' : agentColor ?? 'var(--color-accent)' }}
      >
        {isUser ? <User size={14} /> : (agentName ?? 'A').charAt(0).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={`min-w-0 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
        <div className={`flex items-baseline gap-2 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-[13px] font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {displayName}
          </span>
          <span className="text-[11px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            {time}
          </span>
        </div>
        <div
          className={[
            'mt-1 rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm',
            isUser
              ? 'bg-[var(--color-primary)] text-white rounded-tr-sm'
              : 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)] text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] rounded-tl-sm',
          ].join(' ')}
        >
          <Markdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              h1: ({ children }) => <h1 className="text-base font-bold mb-1.5 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2.5 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
              hr: () => <hr className={`my-2 border-t ${isUser ? 'border-white/20' : 'border-[var(--color-border)] dark:border-[var(--color-border-dark)]'}`} />,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return (
                    <code className="block my-2 rounded-[var(--radius-md)] bg-black/10 dark:bg-black/30 px-3 py-2 text-xs font-mono overflow-x-auto">
                      {children}
                    </code>
                  )
                }
                return (
                  <code className={`rounded px-1 py-0.5 text-xs font-mono ${isUser ? 'bg-white/15' : 'bg-[var(--color-border)] dark:bg-[var(--color-border-dark)]'}`}>
                    {children}
                  </code>
                )
              },
              pre: ({ children }) => <>{children}</>,
            }}
          >
            {message.content}
          </Markdown>
        </div>
      </div>
    </div>
  )
}
