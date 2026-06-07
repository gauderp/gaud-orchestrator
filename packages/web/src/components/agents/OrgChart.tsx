import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { OrgChartNode, type OrgTreeNode } from './OrgChartNode'
import { Bot } from 'lucide-react'

export function OrgChart({ compact }: { compact: boolean }) {
  const [tree, setTree] = useState<OrgTreeNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.agents.getTree()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--color-muted)' }}>
        Loading...
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '64px 24px',
          color: 'var(--color-muted)',
        }}
      >
        <Bot size={40} style={{ opacity: 0.4 }} />
        <div style={{ fontSize: '14px', fontWeight: 500 }}>No agents yet</div>
        <div style={{ fontSize: '13px' }}>Create agents and assign parent relationships to build your hierarchy.</div>
      </div>
    )
  }

  return (
    <div
      style={{
        overflow: 'auto',
        padding: '32px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: '48px' }}>
        {tree.map((root) => (
          <OrgChartNode key={root.agent.id} node={root} compact={compact} />
        ))}
      </div>
    </div>
  )
}
