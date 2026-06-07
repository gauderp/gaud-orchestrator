import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export interface OrgTreeNode {
  agent: {
    id: string
    name: string
    role: string | null
    requiresParentApproval?: number | boolean
    [key: string]: unknown
  }
  children: OrgTreeNode[]
}

export function OrgChartNode({ node, compact }: { node: OrgTreeNode; compact: boolean }) {
  const navigate = useNavigate()
  const agent = node.agent
  const initial = agent.name.charAt(0).toUpperCase()

  const requiresApproval = agent.requiresParentApproval === 1 || agent.requiresParentApproval === true
  const hasChildren = node.children.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Node card */}
      <div
        onClick={() => navigate(`/agents/${agent.id}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: compact ? '8px 12px' : '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-elevated, #fff)',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          minWidth: compact ? '120px' : '200px',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
          e.currentTarget.style.borderColor = 'var(--color-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = 'var(--color-border)'
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: compact ? '28px' : '36px',
            height: compact ? '28px' : '36px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary, #fff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? '12px' : '14px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: compact ? '12px' : '13px',
              color: 'var(--color-ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agent.name}
          </div>
          {!compact && agent.role && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-muted)',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {agent.role}
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {requiresApproval && (
            <Shield size={14} style={{ color: 'var(--color-warning, #f59e0b)' }} />
          )}
        </div>
      </div>

      {/* Connector + children */}
      {hasChildren && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Vertical line down */}
          <div style={{ width: '2px', height: '20px', background: 'var(--color-border)' }} />

          {/* Horizontal bar + children */}
          <div style={{ position: 'relative' }}>
            {node.children.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '2px',
                  background: 'var(--color-border)',
                  width: 'calc(100% - 40px)',
                  minWidth: '40px',
                }}
              />
            )}
            <div style={{ display: 'flex', gap: '24px', paddingTop: '0px' }}>
              {node.children.map((child) => (
                <div key={child.agent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Vertical line to child */}
                  <div style={{ width: '2px', height: '20px', background: 'var(--color-border)' }} />
                  <OrgChartNode node={child} compact={compact} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
