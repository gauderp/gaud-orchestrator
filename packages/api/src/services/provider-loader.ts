import {
  createProviderRegistry,
  createClaudeCliProvider,
  createClaudeApiProvider,
  createOpenAICompatibleProvider,
  createGeminiProvider,
  createCursorCliProvider,
  type ProviderRegistry,
} from '@gaud/providers'

interface ProviderConfig {
  id: string
  type: string
  configJson: Record<string, unknown>
}

const OPENAI_MODELS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4.1': { input: 2 / 1_000_000, output: 8 / 1_000_000 },
  'o3-mini': { input: 1.1 / 1_000_000, output: 4.4 / 1_000_000 },
}

const DEEPSEEK_MODELS: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
  'deepseek-coder': { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
  'deepseek-reasoner': { input: 0.55 / 1_000_000, output: 2.19 / 1_000_000 },
}

export function createRegistryFromConfigs(configs: ProviderConfig[]): ProviderRegistry {
  const registry = createProviderRegistry()

  for (const config of configs) {
    try {
      switch (config.type) {
        case 'claude-cli': {
          const provider = createClaudeCliProvider()
          registry.register({ ...provider, id: config.id })
          break
        }
        case 'claude-api': {
          const apiKey = config.configJson.apiKey as string
          if (!apiKey) break
          const provider = createClaudeApiProvider({ apiKey })
          registry.register({ ...provider, id: config.id })
          break
        }
        case 'openai': {
          const apiKey = config.configJson.apiKey as string
          if (!apiKey) break
          const provider = createOpenAICompatibleProvider({
            id: config.id,
            name: 'OpenAI',
            apiKey,
            baseUrl: (config.configJson.baseUrl as string) ?? 'https://api.openai.com/v1',
            models: OPENAI_MODELS,
          })
          registry.register(provider)
          break
        }
        case 'deepseek': {
          const apiKey = config.configJson.apiKey as string
          if (!apiKey) break
          const provider = createOpenAICompatibleProvider({
            id: config.id,
            name: 'DeepSeek',
            apiKey,
            baseUrl: (config.configJson.baseUrl as string) ?? 'https://api.deepseek.com/v1',
            models: DEEPSEEK_MODELS,
          })
          registry.register(provider)
          break
        }
        case 'gemini': {
          const apiKey = config.configJson.apiKey as string
          if (!apiKey) break
          const provider = createGeminiProvider({ apiKey })
          registry.register({ ...provider, id: config.id })
          break
        }
        case 'cursor': {
          const provider = createCursorCliProvider()
          registry.register({ ...provider, id: config.id })
          break
        }
        default:
          console.warn(`Unknown provider type: ${config.type}`)
      }
    } catch (err) {
      console.error(`Failed to create provider ${config.id} (${config.type}):`, err)
    }
  }

  return registry
}
