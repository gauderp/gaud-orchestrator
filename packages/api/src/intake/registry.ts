import type { BugSourceAdapter } from './types.js'
import { genericAdapter } from './adapters/generic.js'
import { bugsnagAdapter } from './adapters/bugsnag.js'
import { trelloAdapter } from './adapters/trello.js'

const adapters = new Map<string, BugSourceAdapter>()

export function registerAdapter(adapter: BugSourceAdapter) {
  adapters.set(adapter.type, adapter)
}

export function getAdapter(type: string): BugSourceAdapter | undefined {
  return adapters.get(type)
}

// Register built-in adapters
registerAdapter(genericAdapter)
registerAdapter(bugsnagAdapter)
registerAdapter(trelloAdapter)
