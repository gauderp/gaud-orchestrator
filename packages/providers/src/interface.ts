import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

export interface AgentProvider {
  id: string
  name: string
  models: string[]
  spawn(opts: SpawnOpts): Promise<AgentSession>
  send(sessionId: string, message: string): Promise<void>
  kill(sessionId: string): Promise<void>
  onOutput(sessionId: string, cb: (event: OutputEvent) => void): void
  estimateCost(model: string, tokens: { input: number; output: number }): number
}

export interface ProviderRegistry {
  register(provider: AgentProvider): void
  get(id: string): AgentProvider | undefined
  list(): AgentProvider[]
}

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, AgentProvider>()
  return {
    register(provider) {
      providers.set(provider.id, provider)
    },
    get(id) {
      return providers.get(id)
    },
    list() {
      return [...providers.values()]
    },
  }
}
