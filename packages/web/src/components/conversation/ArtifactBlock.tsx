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

  // Extract title from artifact (first # heading or first line)
  const titleMatch = artifact.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1] ?? 'Generated Artifact'

  return (
    <div className="border-l-4 border-[var(--color-accent)] bg-emerald-50 p-4 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {title}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-[var(--radius-md)] bg-white p-3 text-xs font-mono text-[var(--color-ink)] dark:bg-[var(--color-bg-dark)] dark:text-[var(--color-ink-dark)]">
        {artifact}
      </pre>
    </div>
  )
}
