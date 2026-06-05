import { FileText, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface ArtifactBlockProps {
  artifact: string
}

export function ArtifactBlock({ artifact }: ArtifactBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const titleMatch = artifact.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? 'Generated Artifact'

  return (
    <div className="mx-4 mb-2 border-l-2 border-[var(--color-accent)] bg-[var(--color-accent)]/[0.04] rounded-r-[var(--radius-md)] p-3 dark:bg-[var(--color-accent)]/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-white/50 dark:text-[var(--color-muted-dark)] dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-white/50 dark:text-[var(--color-muted-dark)] dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <ExternalLink size={12} />
            {expanded ? 'Collapse' : 'View full'}
          </button>
        </div>
      </div>
      <pre className={`${expanded ? '' : 'max-h-32'} overflow-auto rounded-[var(--radius-md)] bg-white p-2.5 text-xs font-mono text-[var(--color-ink)] dark:bg-[var(--color-bg-dark)] dark:text-[var(--color-ink-dark)]`}>
        {artifact}
      </pre>
    </div>
  )
}
