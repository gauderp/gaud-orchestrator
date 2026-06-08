# Prompt: Vincular Repositórios a Specs

Completar a integração entre Specs e Repositories. Hoje os cards já vinculam repos via `card_repos`, mas specs só recebem repos como texto descartável durante a geração. Precisamos persistir, visualizar e propagar repos nas specs.

Leia os arquivos referenciados antes de editar.

## Escopo — 4 mudanças

### 1. Nova migration: tabela `spec_repos`

Criar `packages/api/src/db/migrations/006_spec_repos.sql`:

```sql
CREATE TABLE IF NOT EXISTS spec_repos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  repo_path TEXT NOT NULL,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spec_repos_spec ON spec_repos(spec_id);
```

Padrão idêntico ao `card_repos` mas sem `spec_path` (não faz sentido aqui).

### 2. Backend — API de spec repos + persistência na geração + propagação no decompose

**Arquivo: `packages/api/src/routes/specs.ts`**

**2a) Adicionar endpoints CRUD para spec_repos:**

Dentro de `specRoutes()`, após os endpoints existentes:

```typescript
// List repos for a spec
app.get<{ Params: { id: string } }>('/api/specs/:id/repos', async (req, reply) => {
  const repos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
  return reply.send(toCamelCaseArray(repos as any[]))
})

// Add repo to spec
app.post<{ Params: { id: string } }>('/api/specs/:id/repos', async (req, reply) => {
  const { repoPath, repositoryId } = req.body as { repoPath: string; repositoryId?: string }
  const id = randomUUID()
  db.prepare('INSERT INTO spec_repos (id, spec_id, repo_path, repository_id) VALUES (?, ?, ?, ?)').run(id, req.params.id, repoPath, repositoryId ?? null)
  const repo = toCamelCase(db.prepare('SELECT * FROM spec_repos WHERE id = ?').get(id) as any)
  return reply.status(201).send(repo)
})

// Remove repo from spec
app.delete<{ Params: { id: string; repoId: string } }>('/api/specs/:id/repos/:repoId', async (req, reply) => {
  db.prepare('DELETE FROM spec_repos WHERE id = ? AND spec_id = ?').run(req.params.repoId, req.params.id)
  return reply.status(204).send()
})
```

**2b) GET /api/specs/:id — incluir repos na resposta:**

No endpoint existente `GET /api/specs/:id`, além de reviews, buscar e incluir repos:

```typescript
const repos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ? ORDER BY created_at').all(req.params.id)
return reply.send({
  ...toCamelCase(spec),
  reviews: toCamelCaseArray(reviews as any[]),
  repos: toCamelCaseArray(repos as any[]),  // NOVO
})
```

**2c) POST /api/specs/generate — persistir repos:**

No endpoint `/api/specs/generate`, após criar a spec e antes do return, inserir os repos recebidos:

```typescript
// Persistir repos vinculados à spec
const repoList = repos ?? []
for (const repoPath of repoList) {
  // Tentar achar repositoryId correspondente
  const registered = db.prepare('SELECT id FROM repositories WHERE github_url = ?').get(repoPath) as any
  db.prepare('INSERT INTO spec_repos (id, spec_id, repo_path, repository_id) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), specId, repoPath, registered?.id ?? null)
}
```

**2d) POST /api/specs/:id/decompose — propagar repos para cards criados:**

No endpoint decompose, após criar cada card, copiar os repos da spec para o card:

```typescript
// Buscar repos da spec
const specRepos = db.prepare('SELECT * FROM spec_repos WHERE spec_id = ?').all(req.params.id) as any[]

// Depois do loop que cria cards, propagar repos:
for (const card of createdCards) {
  for (const sr of specRepos) {
    db.prepare('INSERT INTO card_repos (id, card_id, repo_path, repository_id) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), card.id, sr.repo_path, sr.repository_id)
  }
}
```

### 3. Frontend — SpecStudioPage com dropdown de repos

**Arquivo: `packages/web/src/pages/SpecStudioPage.tsx`**

Substituir o input de texto livre `repoStr` por um seletor de repos registrados (como o CardRepos faz), mas simplificado:

```tsx
import { useState, useEffect } from 'react'
import type { Repository } from '@gaud/shared'
import { api } from '@/api/client'

// Dentro do componente, adicionar:
const [registeredRepos, setRegisteredRepos] = useState<Repository[]>([])
const [selectedRepos, setSelectedRepos] = useState<string[]>([])  // IDs dos repos selecionados

useEffect(() => {
  api.repositories.list().then(setRegisteredRepos)
}, [])

const clonedRepos = registeredRepos.filter(r => r.status === 'cloned')
```

Substituir o `<Input label="Repos (comma-separated)">` por:

```tsx
<div>
  <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-1 block">
    Repositories
  </label>
  <div className="space-y-2">
    {clonedRepos.map(repo => (
      <label key={repo.id} className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] cursor-pointer">
        <input
          type="checkbox"
          checked={selectedRepos.includes(repo.id)}
          onChange={(e) => {
            setSelectedRepos(prev =>
              e.target.checked ? [...prev, repo.id] : prev.filter(id => id !== repo.id)
            )
          }}
          className="rounded"
        />
        <span className="font-mono text-xs truncate">{repo.githubUrl}</span>
      </label>
    ))}
    {clonedRepos.length === 0 && (
      <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
        No repositories registered. <a href="/repositories" className="text-[var(--color-primary)] hover:underline">Add one</a>
      </p>
    )}
  </div>
</div>
```

No `handleSubmit`, mapear IDs para URLs:

```typescript
repos: selectedRepos.map(id => clonedRepos.find(r => r.id === id)?.githubUrl).filter(Boolean) as string[],
```

Remover `repoStr` state e o input antigo.

### 4. Frontend — SpecDetailPage com aba/seção de repos

**Arquivo: `packages/web/src/pages/SpecDetailPage.tsx`**

Adicionar repos à visualização. Duas opções (escolher a mais simples):

**Opção escolhida: seção abaixo das tabs, visível quando tab === 'content'**

Adicionar ao `api` client (`packages/web/src/api/client.ts`), dentro do objeto `specs`:

```typescript
listRepos: (specId: string) => request<Array<{ id: string; specId: string; repoPath: string; repositoryId: string | null; createdAt: string }>>(`/specs/${specId}/repos`),
addRepo: (specId: string, data: { repoPath: string; repositoryId?: string }) => request(`/specs/${specId}/repos`, { method: 'POST', body: JSON.stringify(data) }),
removeRepo: (specId: string, repoId: string) => request<void>(`/specs/${specId}/repos/${repoId}`, { method: 'DELETE' }),
```

Na SpecDetailPage, buscar repos e mostrar:

```tsx
const [specRepos, setSpecRepos] = useState<any[]>([])

useEffect(() => {
  if (id) api.specs.listRepos(id).then(setSpecRepos)
}, [id])
```

Abaixo do header e antes das tabs (ou como sidebar info), mostrar repos vinculados:

```tsx
{specRepos.length > 0 && (
  <div className="flex items-center gap-2 mb-4 flex-wrap">
    <span className="text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Repos:</span>
    {specRepos.map(r => (
      <Badge key={r.id} variant="neutral">
        <span className="font-mono text-[11px]">{r.repoPath}</span>
      </Badge>
    ))}
  </div>
)}
```

### 5. Shared types — adicionar SpecRepo

**Arquivo: `packages/shared/src/types/spec.ts`**

Adicionar:

```typescript
export interface SpecRepo {
  id: string
  specId: string
  repoPath: string
  repositoryId: string | null
  createdAt: string
}
```

E exportar no `index.ts` do shared se necessário.

### 6. Atualizar BackupService

**Arquivo: `packages/api/src/services/BackupService.ts`**

Adicionar `spec_repos` à lista de tabelas exportadas/importadas. Inserir na posição correta (após `spec_reviews`, antes de `executions`) na ordem de restore.

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, nunca `[--color-prop]`
2. **Dark mode**: usar `dark:` variants
3. **Componentes UI**: usar `Button`, `Input`, `Modal`, `Badge` de `@/components/ui/`
4. **DB síncrono**: better-sqlite3, sem promises
5. **Não criar componente separado para SpecRepos** — inline na SpecDetailPage é suficiente, é mais simples que o CardRepos

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. SpecStudio mostra checkboxes dos repos registrados
2. Gerar spec com repos selecionados → spec_repos persistidos
3. SpecDetailPage mostra badges dos repos
4. Decompose propaga repos para os cards criados
5. Backup inclui spec_repos
