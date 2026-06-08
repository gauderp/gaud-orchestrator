# Backup & Restore — Design Spec

## Overview

Full account backup/restore for Gaud Orchestrator. Export all data (database, attachments, agent definitions) as a single ZIP file. Import by uploading a ZIP to wipe and replace all data.

## Decisions

- **Format**: Single ZIP file
- **Repos**: Optional (checkbox, excluded by default) — repos are large and re-clonable
- **Restore mode**: Destructive (wipe + replace) — no merge/conflict resolution
- **No credentials in backup**: API keys and tokens are excluded (security)

## API Endpoints

### `GET /api/backup?includeRepos=false`

Generates and streams a ZIP file as download.

**Query params:**
- `includeRepos` (boolean, default `false`) — include `data/repos/` directory

**Response:** `application/zip` with `Content-Disposition: attachment; filename=backup-{ISO-timestamp}.zip`

**Flow:**
1. Checkpoint SQLite WAL (`PRAGMA wal_checkpoint(TRUNCATE)`)
2. Export each table as JSON array
3. Copy `agents/` directory
4. Copy `data/attachments/` directory
5. If `includeRepos=true`, copy `data/repos/` directory
6. Generate `manifest.json` with metadata
7. Create ZIP and stream as response

### `POST /api/backup/restore`

Accepts ZIP via multipart upload. Wipes all data and restores from backup.

**Request:** `multipart/form-data` with field `file` (ZIP)

**Response:** `{ "status": "ok", "tables": { ... }, "restoredAt": "..." }`

**Flow:**
1. Receive and validate ZIP
2. Parse and validate `manifest.json` (version check)
3. Drop all tables, re-run migrations
4. Insert data from `database.json` in dependency order
5. Replace `agents/` directory contents
6. Replace `data/attachments/` directory contents
7. If backup includes repos, replace `data/repos/`
8. Reload providers and agents in memory
9. Return summary

### `POST /api/backup/preview`

Accepts ZIP, returns manifest without restoring. Used by UI to show confirmation dialog.

**Request:** `multipart/form-data` with field `file` (ZIP)

**Response:** The `manifest.json` content

## ZIP Structure

```
backup-2026-06-08T130000Z.zip
├── manifest.json
├── database.json
├── agents/
│   ├── tech-lead.md
│   ├── api-agent.md
│   └── ...
├── attachments/
│   ├── {card-id}/
│   │   └── file.png
│   └── bugs-{bug-report-id}/
│       └── screenshot.png
└── repos/                    (optional)
    └── github.com/org/repo/
```

### manifest.json

```json
{
  "version": "1.0",
  "createdAt": "2026-06-08T13:00:00.000Z",
  "appVersion": "0.1.0",
  "includesRepos": false,
  "tables": {
    "providers": 3,
    "agents": 12,
    "skills": 5,
    "boards": 2,
    "cards": 45,
    "conversations": 8,
    "messages": 120,
    "specs": 3,
    "executions": 2,
    "bug_reports": 4,
    "repositories": 3
  },
  "attachmentCount": 15,
  "agentFileCount": 19
}
```

### database.json

```json
{
  "providers": [ { "id": "...", "name": "...", ... } ],
  "agents": [ ... ],
  "skills": [ ... ],
  "agent_skills": [ ... ],
  "boards": [ ... ],
  "columns": [ ... ],
  "cards": [ ... ],
  "card_dependencies": [ ... ],
  "card_repos": [ ... ],
  "card_comments": [ ... ],
  "card_attachments": [ ... ],
  "specs": [ ... ],
  "spec_reviews": [ ... ],
  "executions": [ ... ],
  "execution_tasks": [ ... ],
  "execution_logs": [ ... ],
  "execution_gaps": [ ... ],
  "conversations": [ ... ],
  "conversation_participants": [ ... ],
  "messages": [ ... ],
  "agent_cost_log": [ ... ],
  "agent_memories": [ ... ],
  "memory_sessions": [ ... ],
  "agent_reviews": [ ... ],
  "bug_reports": [ ... ],
  "bug_report_attachments": [ ... ],
  "repositories": [ ... ]
}
```

## Restore — Table Insert Order

Respects foreign key dependencies:

```
1. providers
2. agents
3. skills
4. agent_skills
5. boards
6. columns
7. repositories
8. cards
9. card_dependencies
10. card_repos
11. card_comments
12. card_attachments
13. specs
14. spec_reviews
15. executions
16. execution_tasks
17. execution_logs
18. execution_gaps
19. conversations
20. conversation_participants
21. messages
22. agent_cost_log
23. agent_memories
24. memory_sessions
25. agent_reviews
26. bug_reports
27. bug_report_attachments
```

## UI — Settings Page

New route: `/settings/backup` (tab within Settings layout)

### Export Section

- Title: "Export Backup"
- Description text explaining what's included
- Checkbox: "Include Git repositories" (unchecked by default) with size warning
- Button: "Generate Backup" — triggers download of ZIP
- Loading state while generating

### Import Section

- Title: "Restore from Backup"
- Dropzone or file input accepting `.zip`
- After file selected: shows manifest preview (date, table counts, includes repos?)
- Warning banner: "This will permanently replace all existing data"
- Button: "Restore Backup" with destructive styling
- Confirmation modal: "Are you sure? This action cannot be undone."
- Progress/loading state during restore
- Success/error toast after completion

### Navigation

Add "Backup" link in Settings sidebar/tabs, alongside existing "Providers" tab.

## Implementation Files

### Backend (packages/api/)
- `src/routes/backup.ts` — route handlers for GET /backup, POST /restore, POST /preview
- `src/services/BackupService.ts` — export/import logic, ZIP creation, DB operations

### Frontend (packages/web/)
- `src/pages/BackupPage.tsx` — settings page with export/import UI
- `src/lib/api.ts` — add backup API client methods

### Shared
- Update `App.tsx` — add route `/settings/backup`
- Update `Sidebar.tsx` — add Backup link under Settings

## Error Handling

- Invalid ZIP → 400 with message
- Missing manifest → 400 "Invalid backup file"
- Version mismatch → 400 "Backup version X not supported"
- Corrupted database.json → 400 with parse error
- Restore failure mid-way → tables already dropped, return 500 with details (user must re-upload or start fresh)
- File too large → configurable limit (default 500MB, repos can be larger)

## Security

- No API keys or tokens in backup (provider `config_json` is included since it contains API keys configured by the user — they own this data)
- Restore endpoint should require same auth as other admin endpoints
- ZIP bomb protection: validate total uncompressed size before extracting

## Out of Scope

- Scheduled/automatic backups (can be added later via cron)
- Incremental/differential backups
- Cloud storage integration (S3, GCS)
- Backup encryption
- Multi-tenant isolation
