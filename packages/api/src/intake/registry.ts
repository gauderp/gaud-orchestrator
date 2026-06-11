import type { BugSourceAdapter } from './types.js'

const adapters = new Map<string, BugSourceAdapter>()

export function registerAdapter(adapter: BugSourceAdapter) {
  adapters.set(adapter.type, adapter)
}

export function getAdapter(type: string): BugSourceAdapter | undefined {
  return adapters.get(type)
}
