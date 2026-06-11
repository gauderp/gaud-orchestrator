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
  createdAt: string
}

export interface BoardWithColumns extends Board {
  columns: Column[]
}
