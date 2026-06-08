# Prompt: Implementar Backup & Restore

Implemente a feature de Backup & Restore para o Gaud Orchestrator conforme a spec em `docs/superpowers/specs/2026-06-08-backup-restore-design.md`. Leia a spec completa antes de começar.

## Resumo

- **Backup**: `GET /api/backup?includeRepos=false` → gera ZIP com database (JSON), agents/, attachments/, e opcionalmente repos/
- **Restore**: `POST /api/backup/restore` → recebe ZIP, wipe total + restaura
- **Preview**: `POST /api/backup/preview` → retorna manifest do ZIP sem restaurar
- **UI**: página `/settings/backup` com export (botão + checkbox repos) e import (upload + preview + confirmação destrutiva)

## Arquivos a criar

### 1. `packages/api/src/services/BackupService.ts`

Serviço com dois métodos principais:

**`async generateBackup(includeRepos: boolean): Promise<Buffer>`**
- Usa a lib `archiver` (já disponível? se não, adicionar ao package.json do api) para criar ZIP
- Faz `db.pragma('wal_checkpoint(TRUNCATE)')` antes de exportar
- Exporta todas as 27 tabelas como JSON no arquivo `database.json` (ver ordem na spec)
- Copia recursivamente `agents/` (env `AGENTS_DIR` ou `./agents`)
- Copia recursivamente `data/attachments/` (env `ATTACHMENTS_DIR`)
- Se includeRepos, copia `data/repos/` (env `REPOS_DIR`)
- Gera `manifest.json` com versão, timestamp, contagens de cada tabela, flags

**`async restoreBackup(zipBuffer: Buffer): Promise<RestoreResult>`**
- Usa `adm-zip` ou `yauzl` para extrair
- Valida manifest (version === "1.0")
- Desabilita foreign keys temporariamente: `db.pragma('foreign_keys = OFF')`
- Dropa TODAS as tabelas (incluindo `_migrations`): query `SELECT name FROM sqlite_master WHERE type='table'` e `DROP TABLE` cada uma
- Re-roda migrations com `runMigrations()`
- Insere dados do `database.json` na ordem de dependências (ver spec)
- Para cada tabela: faz INSERT em batch (transação) usando os nomes de coluna do JSON
- Reabilita foreign keys: `db.pragma('foreign_keys = ON')`
- Substitui diretório `agents/` (delete + copy)
- Substitui diretório `attachments/` (delete + copy)
- Se backup inclui repos, substitui `data/repos/`
- Retorna `{ status: 'ok', tables: { ... contagens }, restoredAt: ISO }`

**`async previewBackup(zipBuffer: Buffer): Promise<Manifest>`**
- Extrai apenas `manifest.json` do ZIP e retorna parsed

**Referência de acesso ao DB:**
```typescript
import { getDb } from '../db/connection.js'
const db = getDb() // better-sqlite3 instance
// Queries síncronas: db.prepare('...').all(), db.prepare('...').run(...)
// Pragma: db.pragma('wal_checkpoint(TRUNCATE)')
```

**Tabelas na ordem de insert (foreign keys):**
```
providers, agents, skills, agent_skills, boards, columns, repositories,
cards, card_dependencies, card_repos, card_comments, card_attachments,
specs, spec_reviews, executions, execution_tasks, execution_logs, execution_gaps,
conversations, conversation_participants, messages,
agent_cost_log, agent_memories, memory_sessions, agent_reviews,
bug_reports, bug_report_attachments
```

### 2. `packages/api/src/routes/backup.ts`

Padrão das rotas existentes (Fastify). Referência: `packages/api/src/routes/providers.ts`.

```typescript
import type { FastifyInstance } from 'fastify'

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/backup — gerar e baixar ZIP
  // - query: includeRepos (boolean)
  // - chama BackupService.generateBackup()
  // - reply.type('application/zip').header('Content-Disposition', ...).send(buffer)

  // POST /api/backup/restore — upload de ZIP e restore
  // - usa app.multipart (já registrado globalmente em index.ts)
  // - const data = await req.file() — pega o arquivo
  // - const buffer = await data.toBuffer()
  // - chama BackupService.restoreBackup(buffer)
  // - IMPORTANTE: aumentar o limite de upload para este endpoint (500MB)
  //   ou usar req.file({ limits: { fileSize: 500 * 1024 * 1024 } })

  // POST /api/backup/preview — upload de ZIP, retorna manifest
  // - mesma lógica de upload, mas chama BackupService.previewBackup()
}
```

### 3. Registrar rota em `packages/api/src/index.ts`

Adicionar junto das outras rotas:
```typescript
import { backupRoutes } from './routes/backup.js'
// ...
await server.register(backupRoutes)
```

### 4. `packages/web/src/pages/BackupPage.tsx`

Página em `/settings/backup`. Padrão visual do projeto: usa design tokens CSS (`--color-*`, `--radius-*`) com Tailwind v4 syntax `[var(--color-prop)]`. Componentes disponíveis: `Button`, `Input`, `Modal`, `Badge` de `@/components/ui/`.

**Seção Export:**
- Título "Export Backup"
- Texto explicativo
- Checkbox "Include Git repositories" (unchecked por padrão) com warning de tamanho
- Botão "Generate Backup" que faz download:
  ```typescript
  const res = await fetch(`/api/backup?includeRepos=${includeRepos}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = '...'; a.click()
  ```
- Loading state enquanto gera

**Seção Import:**
- Título "Restore from Backup"
- Input file aceita `.zip`
- Após selecionar: chama `/api/backup/preview` via FormData, mostra manifest (data, contagens, includesRepos)
- Warning banner destrutivo
- Botão "Restore" com variante destructive
- Modal de confirmação: "This will permanently replace all existing data. Are you sure?"
- Após restore: toast de sucesso, reload da página

**Referência de API client** (`packages/web/src/api/client.ts`):
- Para backup (download blob), usar `fetch` direto (não o `request<T>()` helper que faz `.json()`)
- Para preview e restore, usar `fetch` com `FormData` (similar ao `bugReports.create`)

Adicionar ao objeto `api`:
```typescript
backup: {
  preview: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return fetch(`${API_BASE}/backup/preview`, { method: 'POST', body: fd })
      .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error) }); return r.json() })
  },
  restore: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return fetch(`${API_BASE}/backup/restore`, { method: 'POST', body: fd })
      .then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error) }); return r.json() })
  },
},
```

### 5. Registrar rota no `packages/web/src/App.tsx`

```typescript
import { BackupPage } from '@/pages/BackupPage'
// Na seção de <Route>:
<Route path="/settings/backup" element={<BackupPage />} />
```

### 6. Adicionar link no `packages/web/src/components/layout/Sidebar.tsx`

No array `configNav`, adicionar:
```typescript
import { HardDrive } from 'lucide-react'
// ...
{ label: 'Backup', to: '/settings/backup', icon: HardDrive },
```

## Regras importantes

1. **Tailwind CSS v4**: custom properties SEMPRE com `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: usar `dark:` variants com tokens `--color-*-dark`
3. **Componentes UI**: usar `Button`, `Modal`, `Input` de `@/components/ui/` — não criar elementos raw
4. **DB é síncrono**: better-sqlite3 é síncrono, `db.prepare().all()` e `db.prepare().run()` não retornam promises
5. **Multipart**: já registrado globalmente em `index.ts` com limite 50MB. Para backup/restore, permitir até 500MB
6. **ZIP lib**: preferir `archiver` para criação e `adm-zip` para leitura (ou outra lib leve). Instalar se necessário com `pnpm --filter @gaud/api add archiver adm-zip` e `pnpm --filter @gaud/api add -D @types/archiver`
7. **Não incluir agent_memories.embedding** no JSON se for BLOB binário — exportar como base64 ou null

## Verificação

Após implementar, rodar:
```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros  
pnpm --filter @gaud/api test         # todos passando
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d  # container saudável
```

Testar manualmente:
1. Acessar `/settings/backup`, gerar backup, verificar ZIP baixado
2. Upload do mesmo ZIP no restore, confirmar que dados são restaurados
3. Preview mostra manifest correto antes do restore
