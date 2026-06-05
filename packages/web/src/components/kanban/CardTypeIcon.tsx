import { FolderKanban, Layers, CheckSquare, Bug } from 'lucide-react'
import type { CardType } from '@gaud/shared'

const icons: Record<CardType, typeof FolderKanban> = {
  project: FolderKanban,
  epic: Layers,
  task: CheckSquare,
  bug: Bug,
}

export function CardTypeIcon({ type, size = 16 }: { type: CardType; size?: number }) {
  const Icon = icons[type]
  return <Icon size={size} />
}
