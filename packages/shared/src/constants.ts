export const CARD_TYPES = ['project', 'epic', 'task', 'bug'] as const
export const CONVERSATION_TYPES = ['spec', 'plan', 'code', 'research', 'review'] as const
export const MEMORY_TYPES = ['conversation', 'error_correction', 'pattern_success', 'code_knowledge', 'user_preference'] as const

export const BOARD_IDS = {
  TRIAGE: 'triage-board',
  SPEC: 'spec-board',
  DEV: 'dev-board',
} as const

export const TRIAGE_COLUMNS = {
  NEW: 'triage-col-new',
  INTERVIEWING: 'triage-col-interviewing',
  TRIAGED: 'triage-col-triaged',
  REJECTED: 'triage-col-rejected',
} as const

export const SPEC_COLUMNS = {
  IDEAS: 'spec-col-ideas',
  DRAFTING: 'spec-col-drafting',
  REVIEW: 'spec-col-review',
  APPROVED: 'spec-col-approved',
} as const

export const DEV_COLUMNS = {
  TODO: 'dev-col-todo',
  IN_PROGRESS: 'dev-col-progress',
  REVIEW: 'dev-col-review',
  DONE: 'dev-col-done',
} as const
