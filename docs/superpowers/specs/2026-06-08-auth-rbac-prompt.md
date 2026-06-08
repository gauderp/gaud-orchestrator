# Prompt: Implementar Autenticação + RBAC + Setup Wizard

Implemente autenticação com email+senha, RBAC com 3 roles, e setup wizard para o Gaud Orchestrator conforme a spec em `docs/superpowers/specs/2026-06-08-auth-rbac-design.md`. Leia a spec completa antes de começar.

## Resumo

- **Auth**: JWT (access 15min + refresh 7d) com email+senha
- **Roles**: admin (tudo), editor (CRUD operacional), viewer (leitura)
- **Setup wizard**: primeira execução cria admin + configura providers + GitHub token
- **Public routes**: login, refresh, setup/status, setup/complete, health, slack-webhook

## Dependências a instalar

```bash
pnpm --filter @gaud/api add bcryptjs jsonwebtoken
pnpm --filter @gaud/api add -D @types/bcryptjs @types/jsonwebtoken
```

## Arquivos a criar

### 1. `packages/api/src/db/migrations/007_auth.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS setup_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO setup_state (key, value) VALUES ('setup_completed', 'false');
```

### 2. `packages/api/src/middleware/auth.ts`

Auth middleware e role guard para Fastify.

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/connection.js'

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '15m'
const JWT_REFRESH_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d'

export interface JwtPayload {
  userId: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

// Routes that don't need auth
const PUBLIC_ROUTES = [
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'GET /api/setup/status',
  'POST /api/setup/complete',
  'GET /api/health',
  'POST /api/slack-webhook',
]

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const routeKey = `${req.method} ${req.routeOptions?.url ?? req.url.split('?')[0]}`

    // Skip public routes
    if (PUBLIC_ROUTES.some(r => routeKey.startsWith(r))) return

    // Also skip static files and websocket upgrade (WS auth handled separately)
    if (!req.url.startsWith('/api/')) return

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    try {
      const token = authHeader.slice(7)
      const payload = verifyToken(token)

      // Verify user still exists and is active
      const db = getDb()
      const user = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.userId) as any
      if (!user || !user.active) {
        return reply.status(401).send({ error: 'User not found or inactive' })
      }

      // Attach user to request
      ;(req as any).user = { id: user.id, name: user.name, email: user.email, role: user.role }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }
  })
}

// Role hierarchy: admin > editor > viewer
const ROLE_LEVEL: Record<string, number> = { admin: 3, editor: 2, viewer: 1 }

export function requireRole(minRole: 'admin' | 'editor' | 'viewer') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user
    if (!user) return reply.status(401).send({ error: 'Authentication required' })
    if ((ROLE_LEVEL[user.role] ?? 0) < ROLE_LEVEL[minRole]) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
  }
}
```

### 3. `packages/api/src/routes/auth.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { signAccessToken, signRefreshToken, verifyToken } from '../middleware/auth.js'
import { toCamelCase } from '../utils/case.js'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()

  // Login
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string }
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  })

  // Refresh token
  app.post('/api/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    try {
      const payload = verifyToken(refreshToken)
      // Verify user still active
      const user = db.prepare('SELECT id, email, role, active FROM users WHERE id = ?').get(payload.userId) as any
      if (!user || !user.active) return reply.status(401).send({ error: 'User not found or inactive' })

      const newPayload = { userId: user.id, email: user.email, role: user.role }
      return reply.send({ accessToken: signAccessToken(newPayload) })
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }
  })

  // Get current user
  app.get('/api/auth/me', async (req, reply) => {
    const user = (req as any).user
    if (!user) return reply.status(401).send({ error: 'Not authenticated' })
    return reply.send(user)
  })
}
```

### 4. `packages/api/src/routes/setup.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { signAccessToken, signRefreshToken } from '../middleware/auth.js'

export async function setupRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()

  // Check setup status
  app.get('/api/setup/status', async (_req, reply) => {
    const row = db.prepare("SELECT value FROM setup_state WHERE key = 'setup_completed'").get() as any
    return reply.send({ completed: row?.value === 'true' })
  })

  // Complete setup — creates admin user, providers, and optionally GitHub token
  app.post('/api/setup/complete', async (req, reply) => {
    // Check not already completed
    const row = db.prepare("SELECT value FROM setup_state WHERE key = 'setup_completed'").get() as any
    if (row?.value === 'true') {
      return reply.status(400).send({ error: 'Setup already completed' })
    }

    const { admin, providers, githubToken } = req.body as {
      admin: { name: string; email: string; password: string }
      providers?: Array<{ name: string; type: string; configJson: Record<string, unknown> }>
      githubToken?: string
    }

    // Validate admin
    if (!admin?.name || !admin?.email || !admin?.password) {
      return reply.status(400).send({ error: 'Admin name, email, and password are required' })
    }
    if (admin.password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    }

    const userId = randomUUID()
    const hash = bcrypt.hashSync(admin.password, 12)

    // Transaction: create admin + providers + mark setup complete
    const tx = db.transaction(() => {
      // Create admin user
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')
      `).run(userId, admin.name, admin.email, hash)

      // Create providers if any
      if (providers?.length) {
        for (const p of providers) {
          db.prepare('INSERT INTO providers (id, name, type, config_json) VALUES (?, ?, ?, ?)')
            .run(randomUUID(), p.name, p.type, JSON.stringify(p.configJson))
        }
      }

      // Store GitHub token as env hint (providers can use it)
      // Note: GITHUB_TOKEN is still an env var, but we store a reference
      if (githubToken) {
        db.prepare("INSERT OR REPLACE INTO setup_state (key, value) VALUES ('github_token', ?)")
          .run(githubToken)
      }

      // Mark setup complete
      db.prepare("UPDATE setup_state SET value = 'true' WHERE key = 'setup_completed'").run()
    })
    tx()

    // Return tokens so user is immediately logged in
    const payload = { userId, email: admin.email, role: 'admin' as const }
    return reply.status(201).send({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: userId, name: admin.name, email: admin.email, role: 'admin' },
    })
  })
}
```

### 5. `packages/api/src/routes/users.ts`

CRUD de users (admin only). Todos os endpoints usam `preHandler: [requireRole('admin')]`.

```typescript
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { requireRole } from '../middleware/auth.js'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()
  const adminOnly = requireRole('admin')

  function sanitize(u: any) {
    const { password_hash, ...rest } = u
    return toCamelCase(rest)
  }

  // List users
  app.get('/api/users', { preHandler: [adminOnly] }, async (_req, reply) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at').all() as any[]
    return reply.send(users.map(sanitize))
  })

  // Create user
  app.post('/api/users', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, email, password, role } = req.body as any
    if (!name || !email || !password) return reply.status(400).send({ error: 'name, email, password required' })
    if (password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })

    const id = randomUUID()
    const hash = bcrypt.hashSync(password, 12)
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, hash, role ?? 'editor')
    return reply.status(201).send(sanitize(db.prepare('SELECT * FROM users WHERE id = ?').get(id)))
  })

  // Update user
  app.put<{ Params: { id: string } }>('/api/users/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, email, role, active } = req.body as any
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'User not found' })

    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(name ?? existing.name, email ?? existing.email, role ?? existing.role, active ?? existing.active, req.params.id)
    return reply.send(sanitize(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)))
  })

  // Delete (soft) — set active=0
  app.delete<{ Params: { id: string } }>('/api/users/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const user = (req as any).user
    if (user.id === req.params.id) return reply.status(400).send({ error: 'Cannot deactivate yourself' })
    db.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id)
    return reply.status(204).send()
  })

  // Reset password
  app.put<{ Params: { id: string } }>('/api/users/:id/password', { preHandler: [adminOnly] }, async (req, reply) => {
    const { password } = req.body as { password: string }
    if (!password || password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    const hash = bcrypt.hashSync(password, 12)
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.params.id)
    return reply.status(204).send()
  })
}
```

### 6. Registrar em `packages/api/src/index.ts`

Adicionar ANTES do registro das outras rotas:

```typescript
import { authPlugin } from './middleware/auth.js'
import { authRoutes } from './routes/auth.js'
import { setupRoutes } from './routes/setup.js'
import { userRoutes } from './routes/users.js'

// Register auth middleware (MUST be before other routes)
await server.register(authPlugin)

// Register auth/setup/user routes
await server.register(authRoutes)
await server.register(setupRoutes)
await server.register(userRoutes)

// ... existing routes (healthRoutes, skillRoutes, etc.)
```

Também adicionar `requireRole` guards às rotas admin-only existentes. Nos arquivos de rotas:

**Admin-only routes (adicionar `preHandler: [requireRole('admin')]`):**
- `packages/api/src/routes/providers.ts` — POST, PUT, DELETE
- `packages/api/src/routes/agents.ts` — POST, PUT, DELETE
- `packages/api/src/routes/skills.ts` — POST, PUT, DELETE
- `packages/api/src/routes/backup.ts` — GET /backup, POST /restore, POST /preview

**Editor+ routes (adicionar `preHandler: [requireRole('editor')]`):**
- `packages/api/src/routes/cards.ts` — POST, PUT, DELETE, move, comments
- `packages/api/src/routes/boards.ts` — POST, PUT, DELETE
- `packages/api/src/routes/specs.ts` — POST, PUT, generate, decompose, review
- `packages/api/src/routes/executions.ts` — POST, execute, cancel
- `packages/api/src/routes/conversations.ts` — POST, sendMessage, nextTurn
- `packages/api/src/routes/bug-reports.ts` — POST, triage, respond, create-card
- `packages/api/src/routes/github.ts` — POST /repositories, POST sync, DELETE

**Viewer (GET routes) — no guard needed, auth middleware already validates JWT.**

Para adicionar guards, importar `requireRole` do middleware e usar:
```typescript
import { requireRole } from '../middleware/auth.js'

// Exemplo:
app.post('/api/providers', { preHandler: [requireRole('admin')] }, async (req, reply) => { ... })
```

### 7. WebSocket auth em `packages/api/src/index.ts`

Modificar o handler do WebSocket:

```typescript
import { verifyToken } from './middleware/auth.js'

server.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, req) => {
    // Validate token from query param
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    if (!token) { socket.close(4001, 'Token required'); return }
    try {
      verifyToken(token)
      addClient(socket)
    } catch {
      socket.close(4001, 'Invalid token')
    }
  })
})
```

### 8. Shared types — `packages/shared/src/types/user.ts`

```typescript
export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}
```

Exportar em `packages/shared/src/types/index.ts`:
```typescript
export type * from './user.js'
```

### 9. `packages/web/src/store/auth.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@gaud/shared'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<boolean>
  fetchMe: () => Promise<void>
  setupComplete: (data: any) => Promise<void>
}

const API = '/api'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Login failed')
        }
        const data = await res.json()
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const res = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
          if (!res.ok) { get().logout(); return false }
          const data = await res.json()
          set({ accessToken: data.accessToken })
          return true
        } catch { get().logout(); return false }
      },

      fetchMe: async () => {
        const { accessToken } = get()
        if (!accessToken) return
        const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) { get().logout(); return }
        const user = await res.json()
        set({ user, isAuthenticated: true })
      },

      setupComplete: async (data) => {
        const res = await fetch(`${API}/setup/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Setup failed')
        }
        const result = await res.json()
        set({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, isAuthenticated: true })
      },
    }),
    { name: 'gaud-auth' }
  )
)
```

### 10. `packages/web/src/api/client.ts` — adicionar interceptor de auth

Modificar a função `request<T>()` existente para incluir token e handle 401:

```typescript
import { useAuthStore } from '@/store/auth'

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  // Add auth token
  const token = useAuthStore.getState().accessToken
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  })

  // On 401, try refresh and retry once
  if (res.status === 401 && token) {
    const refreshed = await useAuthStore.getState().refresh()
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
      })
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().logout()
    }
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
```

**IMPORTANTE**: os métodos `bugReports.create`, `backup.preview`, `backup.restore` que usam `fetch()` direto também precisam do header Authorization. Atualizar cada um adicionando:
```typescript
const token = useAuthStore.getState().accessToken
fetch(url, { ..., headers: token ? { Authorization: `Bearer ${token}` } : {} })
```

### 11. `packages/web/src/pages/LoginPage.tsx`

Página de login simples — sem Layout wrapper.

- Input email + Input senha + Button "Login"
- Erro mostrado em banner destrutivo
- Após login → redirect para `/`
- Link "Gaud.ai" como branding no topo
- Design centralizado na tela, card com sombra sutil

Usar componentes `Input` e `Button` de `@/components/ui/`.
Tailwind v4: `[var(--color-*)]` syntax.

### 12. `packages/web/src/pages/SetupPage.tsx`

Setup wizard com 3 steps — sem Layout wrapper.

**Step 1: Admin Account**
- Input: Name, Email, Password, Confirm Password
- Validação: password >= 8 chars, password === confirm

**Step 2: LLM Provider**
- Select: tipo do provider (claude-api, openai, gemini, deepseek)
- Input: nome do provider
- Input: API Key
- Button "Test Connection" (chama POST /api/providers/:id/test — porém antes do setup estar completo, pode testar no client-side ou pular)
- Pode pular (provider é opcional)

**Step 3: GitHub Token**
- Input: GITHUB_TOKEN
- Texto explicativo com link para criar token
- Pode pular

**Submit**: envia tudo via `setupComplete()` do auth store → redireciona para `/`

UI: steps indicator no topo (1 → 2 → 3), botões Next/Back/Skip/Complete.

### 13. `packages/web/src/pages/UsersPage.tsx`

Tabela de users (admin only).

- Lista users com nome, email, role badge, status (active/inactive), data
- Botão "Add User" abre modal com: name, email, password, role select
- Ações por linha: editar (nome, email, role), toggle active, reset password
- Usar `Modal`, `Input`, `Button`, `Badge` de `@/components/ui/`

### 14. `packages/web/src/App.tsx` — Auth routing

Reestruturar o App para suportar auth flow:

```tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null)
  const { isAuthenticated, fetchMe } = useAuthStore()

  useEffect(() => {
    fetch('/api/setup/status').then(r => r.json()).then(d => setSetupCompleted(d.completed))
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchMe()
  }, [])

  if (setupCompleted === null) return null // loading

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public routes — no layout */}
          <Route path="/setup" element={setupCompleted ? <Navigate to="/" replace /> : <SetupPage onComplete={() => setSetupCompleted(true)} />} />
          <Route path="/login" element={!setupCompleted ? <Navigate to="/setup" replace /> : isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

          {/* Protected routes — with layout */}
          <Route element={<AuthGuard><Layout /></AuthGuard>}>
            {/* ... all existing routes ... */}
            <Route path="/settings/users" element={<UsersPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={!setupCompleted ? '/setup' : isAuthenticated ? '/' : '/login'} replace />} />
        </Routes>
      </ErrorBoundary>
      <CommandPalette />
      <ToastContainer />
    </BrowserRouter>
  )
}
```

**IMPORTANTE**: mover o WebSocket connection de `AppRoutes` para dentro do `AuthGuard` ou `Layout`, e incluir o token:
```typescript
const token = useAuthStore.getState().accessToken
const ws = new WebSocket(`ws://${location.hostname}:${wsPort}/ws?token=${token}`)
```

### 15. `packages/web/src/components/layout/Header.tsx`

Adicionar ao header (no lado direito):
- Nome do user + badge com role
- Botão logout (icon LogOut de lucide-react)

```tsx
import { useAuthStore } from '@/store/auth'
import { LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

// Dentro do Header, após o nav de breadcrumbs:
const { user, logout } = useAuthStore()

// No JSX, lado direito do header:
<div className="ml-auto flex items-center gap-2">
  {user && (
    <>
      <span className="text-[13px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{user.name}</span>
      <Badge variant="neutral">{user.role}</Badge>
      <button onClick={logout} className="... cursor-pointer" title="Logout">
        <LogOut size={14} />
      </button>
    </>
  )}
</div>
```

### 16. `packages/web/src/components/layout/Sidebar.tsx`

Adicionar link "Users" no `configNav` (visível só para admin):

```typescript
import { Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

// Dentro do componente Sidebar:
const user = useAuthStore((s) => s.user)

// configNav filtrado:
const filteredConfigNav = configNav.filter(item => {
  // Users page is admin-only
  if (item.to === '/settings/users') return user?.role === 'admin'
  return true
})
```

Adicionar ao array `configNav`:
```typescript
{ label: 'Users', to: '/settings/users', icon: Users },
```

### 17. `.env.example` e `docker-compose.yml`

Adicionar:
```
JWT_SECRET=change-me-to-a-random-64-char-string
```

No `docker-compose.yml`, na seção environment:
```yaml
- JWT_SECRET=${JWT_SECRET:-dev-secret-change-in-production}
```

### 18. BackupService

Adicionar tabelas `users` e `setup_state` ao backup/restore.
- `users` deve ser inserido ANTES de tudo (posição 0 na ordem)
- `setup_state` logo após users (posição 1)
- Na exportação, **excluir password_hash** ou **incluir** (decisão: incluir, pois backup é para restore completo)

## Regras importantes

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants com tokens `--color-*-dark`
3. **Componentes UI**: usar `Button`, `Input`, `Modal`, `Badge` de `@/components/ui/`
4. **DB síncrono**: better-sqlite3, bcrypt.hashSync/compareSync (não async)
5. **JWT_SECRET**: fallback para dev mas DEVE ser configurado em produção
6. **Setup wizard**: após completar, o user é automaticamente logado (recebe tokens no response)
7. **Não quebrar rotas existentes**: os GET routes continuam funcionando para viewer+, apenas POST/PUT/DELETE ganham guards

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Testar manualmente:
1. Primeiro acesso → redireciona para `/setup`
2. Completar wizard (admin + provider + github token) → logado automaticamente
3. Acessar `/settings/users` → criar editor e viewer
4. Logout → login como editor → não vê Users/Providers/Backup
5. Login como viewer → só consegue visualizar
6. Token expirado → refresh automático
7. WebSocket funciona com token
8. Backup inclui users e setup_state
