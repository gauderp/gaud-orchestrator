interface TypingIndicatorProps {
  agentNames: string[]
  agentColors: Record<string, string>
}

export function TypingIndicator({ agentNames, agentColors }: TypingIndicatorProps) {
  if (agentNames.length === 0) return null

  const name = agentNames[0]!
  const color = agentColors[agentNames[0]!] ?? 'var(--color-accent)'

  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Avatar */}
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5"
        style={{ backgroundColor: color }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Typing animation */}
      <div className="flex items-center gap-1 pt-1.5">
        <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {name}
        </span>
        <div className="flex items-center gap-0.5 ml-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
