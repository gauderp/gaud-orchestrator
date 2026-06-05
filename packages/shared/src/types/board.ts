export interface Board {
  id: string
  name: string
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  color: string
  position: number
  agentActionPrompt: string | null
  autoMove: boolean
  roleRequired: string | null
  createdAt: string
}

export interface BoardWithColumns extends Board {
  columns: Column[]
}
