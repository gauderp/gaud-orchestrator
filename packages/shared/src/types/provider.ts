export interface SpawnOpts {
  prompt: string
  cwd: string
  env?: Record<string, string>
  model?: string
  systemPrompt?: string
  addDirs?: string[]
}

export interface OutputEvent {
  type: 'stdout' | 'stderr' | 'approval_request' | 'cost'
  content: string
  timestamp: string
  tokens?: { input: number; output: number }
  cost?: number
}

export interface AgentSession {
  id: string
  status: 'running' | 'paused' | 'done' | 'failed'
}

export interface ProviderConfig {
  id: string
  name: string
  type: string
  configJson: Record<string, unknown>
  createdAt: string
}
