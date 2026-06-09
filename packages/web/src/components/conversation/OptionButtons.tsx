interface OptionButtonsProps {
  content: string
  onSelect: (option: string) => void
  disabled?: boolean
}

export function OptionButtons({ content, onSelect, disabled }: OptionButtonsProps) {
  const match = content.match(/\[OPTIONS\]\s*([\s\S]*?)\s*\[\/OPTIONS\]/i)
  if (!match) return null

  const options = match[1]!
    .split('\n')
    .map(line => line.trim().replace(/^-\s*/, '').trim())
    .filter(Boolean)

  if (options.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option, i) => (
        <button
          key={i}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15 hover:border-[var(--color-primary)]/50 disabled:opacity-50 cursor-pointer dark:border-[var(--color-primary)]/20 dark:bg-[var(--color-primary)]/10 dark:hover:bg-[var(--color-primary)]/20"
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function stripOptions(content: string): string {
  return content.replace(/\[OPTIONS\]\s*[\s\S]*?\[\/OPTIONS\]/gi, '').trim()
}
