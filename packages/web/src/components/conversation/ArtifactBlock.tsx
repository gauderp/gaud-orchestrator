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
    <div className="border-l-4 border-[--color-accent] bg-emerald-50 p-4 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[--color-accent]" />
          <span className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {title}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-[--radius-md] px-2 py-1 text-xs text-[--color-muted] hover:bg-[--color-surface] dark:text-[--color-muted-dark] dark:hover:bg-[--color-surface-dark]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-[--radius-md] bg-white p-3 text-xs font-mono text-[--color-ink] dark:bg-[--color-bg-dark] dark:text-[--color-ink-dark]">
        {artifact}
      </pre>
    </div>
  )
}
