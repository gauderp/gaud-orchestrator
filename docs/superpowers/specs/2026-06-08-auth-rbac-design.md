# Authentication + RBAC + Setup Wizard — Design Spec

## Overview

Add email+password authentication, role-based access control (admin/editor/viewer), and a first-run setup wizard to Gaud Orchestrator. Today the system is 100% open with no user identity.

## Decisions

- **Auth method**: Email + password (OAuth later)
- **Token strategy**: JWT stateless (access 15min + refresh 7d)
- **Roles**: Admin, Editor, Viewer (hierarchical)
- **First user**: Setup wizard on first run (creates admin + providers + GitHub token)
- **Restore mode**: Destructive (wipe + replace)
- **Public routes**: login, setup, health, slack-webhook only

## Roles & Permissions

| Action | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Setup wizard | x | | |
| Manage users | x | | |
| Configure providers | x | | |
| Manage agents/skills | x | | |
| Backup/restore | x | | |
| CRUD boards/cards/specs | x | x | |
| Conversations (send msg) | x | x | |
| Bug reports (create/triage) | x | x | |
| Executions (create/run) | x | x | |
| Repositories (add/sync) | x | x | |
| View everything | x | x | x |

## Database Schema (migration 007)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE setup_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO setup_state (key, value) VALUES ('setup_completed', 'false');
```

## API Endpoints

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` — `{ refreshToken }` → `{ accessToken }`
- `GET /api/auth/me` — returns current user from JWT

### Setup
- `GET /api/setup/status` — `{ completed: boolean }`
- `POST /api/setup/complete` — `{ admin: { name, email, password }, providers: [{ name, type, configJson }], githubToken? }` → creates admin user, providers, sets setup_completed=true

### Users (admin only)
- `GET /api/users` — list users
- `POST /api/users` — create user
- `PUT /api/users/:id` — update user (name, email, role, active)
- `DELETE /api/users/:id` — soft-delete (set active=0)
- `PUT /api/users/:id/password` — reset password

### Public routes (no JWT required)
- `/api/auth/login`
- `/api/auth/refresh`
- `/api/setup/status`
- `/api/setup/complete`
- `/api/health`
- `/api/slack-webhook`

## Auth Middleware

Global Fastify `onRequest` hook:
1. Skip public routes
2. Extract `Authorization: Bearer <token>`
3. Verify JWT, decode `{ userId, role, email }`
4. Fetch user from DB, check `active=1`
5. Set `req.user = { id, name, email, role }`
6. If invalid → 401

Role guard helper: `requireRole('admin' | 'editor' | 'viewer')` — checks hierarchical role on specific routes, returns 403 if insufficient.

## WebSocket Auth

Token passed as query param: `ws://host:3001/ws?token=<jwt>`
Validated on handshake; connection rejected if invalid.

## Frontend

### New Files
- `src/pages/LoginPage.tsx` — email + password form
- `src/pages/SetupPage.tsx` — multi-step wizard (admin account → providers → GitHub token)
- `src/pages/UsersPage.tsx` — user management table (admin only)
- `src/store/auth.ts` — Zustand store with user, tokens, login/logout/refresh actions

### Modified Files
- `src/App.tsx` — auth routing logic (setup → login → app)
- `src/api/client.ts` — add Authorization header to all requests, handle 401 → refresh
- `src/components/layout/Header.tsx` — show user name + role badge + logout button
- `src/components/layout/Sidebar.tsx` — add Users link (admin only)

### App.tsx Auth Flow
```
Boot → GET /api/setup/status
  → Not completed → Render SetupPage (no layout)
  → Completed → Check auth store for token
    → No token → Render LoginPage (no layout)
    → Has token → GET /api/auth/me
      → Valid → Render Layout + AppRoutes
      → Invalid → Clear tokens → LoginPage
```

### WebSocket with Auth
```typescript
const token = useAuthStore.getState().accessToken
const ws = new WebSocket(`ws://${host}:${port}/ws?token=${token}`)
```

### API Client Interceptor
```typescript
// Before each request: add Authorization header
// On 401 response: attempt refresh, retry once, then logout
```

## Environment Variables

```
JWT_SECRET=<random-64-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Add to `.env.example` and Docker Compose.

## Migration of Existing Data

Fields `author_id`, `sender_id`, `created_by_id` that are currently `null` for "the user" continue to work. New records created after auth will use the real `user.id`. No schema changes needed for existing tables.

## Security

- Passwords hashed with bcrypt (cost 12)
- JWT signed with HS256
- Refresh tokens stored client-side only (localStorage)
- Active flag allows disabling users without deleting
- Admin cannot deactivate themselves

## Out of Scope

- OAuth (Google/GitHub) — future
- Password reset via email
- Two-factor authentication
- Session revocation blacklist
- Rate limiting on login
