import { FileText, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface ArtifactBlockProps {
  artifact: string
}

export function ArtifactBlock({ artifact }: ArtifactBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const titleMatch = artifact.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? 'Generated Artifact'

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04] p-4 dark:bg-[var(--color-accent)]/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {title}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-white/50 dark:text-[var(--color-muted-dark)] dark:hover:bg-white/5 cursor-pointer transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-[var(--radius-md)] bg-white p-3 text-xs font-mono text-[var(--color-ink)] dark:bg-[#09090B] dark:text-[var(--color-ink-dark)]">
        {artifact}
      </pre>
    </div>
  )
}
