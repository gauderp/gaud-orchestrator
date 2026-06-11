import { Link } from 'react-router-dom'
import { ClipboardCheck, Lightbulb, Code2 } from 'lucide-react'
import { BOARD_IDS } from '@gaud/shared'

const BOARDS = [
  {
    id: BOARD_IDS.TRIAGE,
    name: 'Triage',
    description: 'Bug reports: intake, interview, and triage',
    icon: ClipboardCheck,
    color: '#F59E0B',
  },
  {
    id: BOARD_IDS.SPEC,
    name: 'Spec',
    description: 'Feature specs: ideation, drafting, review, and approval',
    icon: Lightbulb,
    color: '#8B5CF6',
  },
  {
    id: BOARD_IDS.DEV,
    name: 'Dev',
    description: 'Development: tasks from triage and specs through to completion',
    icon: Code2,
    color: '#10B981',
  },
] as const

export default function BoardListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Boards</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BOARDS.map((board) => {
          const Icon = board.icon
          return (
            <Link
              key={board.id}
              to={`/boards/${board.id}`}
              className="flex items-start gap-4 p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${board.color}20`, color: board.color }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {board.name}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {board.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
