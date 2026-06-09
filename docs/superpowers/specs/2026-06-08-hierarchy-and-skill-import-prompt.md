# Prompt: Hierarquia de Agents no Setup + Importação de Skills

Duas features relacionadas:
1. Setup wizard cria agents com hierarquia (parent_agent_id)
2. Importação de skills via GitHub URL ou upload, formato compatível com Claude Code skills

Leia os arquivos referenciados antes de editar.

---

## Parte 1: Hierarquia no Setup

### Mapa da hierarquia

```
tech-lead (raiz, sem parent)
├── backend-lead
│   ├── api-agent
│   ├── database-agent
│   └── integration-agent
├── frontend-lead
│   └── ui-agent
├── qa-lead
│   ├── test-agent
│   └── security-agent
├── devops-agent
└── triage-agent
```

### 1a. Backend — `packages/api/src/routes/setup.ts`

O campo `agents` no `POST /api/setup/complete` já aceita arrays de agents. Precisa:

1. Aceitar campo `parentName` em cada agent (referência pelo name, não ID, já que IDs são gerados no momento)
2. Criar agents em ordem topológica (pai antes dos filhos)
3. Resolver `parentName` → `parent_agent_id` usando um Map de names→IDs criados

Modificar a criação de agents na transaction:

```typescript
if (agents?.length) {
  const firstProvider = providers?.length
    ? db.prepare('SELECT id FROM providers ORDER BY created_at DESC LIMIT 1').get() as any
    : null

  // Map to track name → generated ID for hierarchy resolution
  const nameToId = new Map<string, string>()

  // Sort: agents without parentName first (roots), then children
  const sorted = [...agents].sort((a, b) => {
    if (!a.parentName && b.parentName) return -1
    if (a.parentName && !b.parentName) return 1
    return 0
  })

  for (const a of sorted) {
    const agentId = randomUUID()
    const parentId = a.parentName ? nameToId.get(a.parentName) ?? null : null
    db.prepare(`
      INSERT INTO agents (id, name, role, instructions, provider_id, model, parent_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, a.name, a.role, a.instructions, firstProvider?.id ?? null, a.model, parentId)
    nameToId.set(a.name, agentId)
  }
}
```

### 1b. Frontend — `packages/web/src/pages/SetupPage.tsx`

No Step 4 (Dev Team), ao construir `data.agents` no `handleComplete`, incluir `parentName`:

```typescript
const HIERARCHY: Record<string, string> = {
  'backend-lead': 'tech-lead',
  'frontend-lead': 'tech-lead',
  'qa-lead': 'tech-lead',
  'devops-agent': 'tech-lead',
  'triage-agent': 'tech-lead',
  'api-agent': 'backend-lead',
  'database-agent': 'backend-lead',
  'integration-agent': 'backend-lead',
  'ui-agent': 'frontend-lead',
  'test-agent': 'qa-lead',
  'security-agent': 'qa-lead',
}
```

No `handleComplete`:

```typescript
if (selectedAgents.size > 0) {
  data.agents = agentTemplates
    .filter(a => selectedAgents.has(a.name))
    .map(a => ({
      name: a.name,
      role: a.description,
      instructions: a.instructions,
      model: a.model,
      parentName: HIERARCHY[a.name] ?? null,
    }))
}
```

**Regra importante:** se o parent não foi selecionado, o agent vira root (parentName null). Exemplo: se selecionou `api-agent` mas NÃO `backend-lead`, o `api-agent` fica sem parent.

```typescript
// Filtrar parentName para agents que realmente foram selecionados
.map(a => ({
  ...
  parentName: HIERARCHY[a.name] && selectedAgents.has(HIERARCHY[a.name]) 
    ? HIERARCHY[a.name] 
    : null,
}))
```

### 1c. Visualização da hierarquia no Step 4

Na UI do Step 4, mostrar a hierarquia visualmente com indentação nos checkboxes:

- Tier 1/2/3 agrupamento atual pode ser mantido
- Mas dentro de cada tier, indentar agents que são filhos
- Ou: adicionar uma indicação sutil de "reports to: tech-lead" no description

Opção simples — adicionar após o description do agent:

```tsx
{HIERARCHY[agent.name] && (
  <span className="text-[10px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
    → reports to {HIERARCHY[agent.name]}
  </span>
)}
```

---

## Parte 2: Importação de Skills

### 2a. Migration — `packages/api/src/db/migrations/009_skill_source.sql`

Adicionar campos de origem à tabela `skills`:

```sql
ALTER TABLE skills ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE skills ADD COLUMN source_url TEXT;
ALTER TABLE skills ADD COLUMN source_ref TEXT;
```

- `source`: 'manual' | 'github' | 'upload'
- `source_url`: URL do GitHub de onde foi importada (para updates futuros)
- `source_ref`: commit SHA ou branch no momento da importação

### 2b. Backend — `packages/api/src/services/SkillImporter.ts`

Serviço que importa skills de GitHub URLs. Aceita 3 formatos de URL:

1. **Arquivo único**: `github.com/user/repo/blob/main/skills/my-skill/SKILL.md`
2. **Pasta**: `github.com/user/repo/tree/main/skills/my-skill`  
3. **Repo inteiro**: `github.com/user/repo`

```typescript
import { randomUUID } from 'crypto'

interface ParsedGithubUrl {
  owner: string
  repo: string
  branch: string
  path: string      // '' for repo root, 'skills/my-skill' for folder
  type: 'file' | 'tree' | 'repo'
}

interface ImportedSkill {
  name: string
  description: string
  content: string
  sourceUrl: string
  sourceRef: string
}

export class SkillImporter {
  constructor(private githubToken?: string) {}

  // Parse GitHub URL into components
  parseUrl(url: string): ParsedGithubUrl {
    // Strip https://github.com/
    const cleaned = url.replace(/^https?:\/\/(www\.)?github\.com\//, '')
    const parts = cleaned.split('/')

    const owner = parts[0]
    const repo = parts[1]

    if (parts.length <= 2) {
      // Repo root: github.com/user/repo
      return { owner, repo, branch: 'main', path: '', type: 'repo' }
    }

    const urlType = parts[2] // 'blob' or 'tree'
    const branch = parts[3]
    const path = parts.slice(4).join('/')

    return {
      owner, repo, branch,
      path,
      type: urlType === 'blob' ? 'file' : urlType === 'tree' ? 'tree' : 'repo',
    }
  }

  // Fetch file content from GitHub API
  async fetchFile(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3.raw' }
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers }
    )
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} for ${path}`)
    return res.text()
  }

  // List directory contents from GitHub API
  async listDir(owner: string, repo: string, path: string, branch: string): Promise<Array<{ name: string; path: string; type: string }>> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    return res.json()
  }

  // Parse SKILL.md content (Claude Code skill format)
  parseSkillFile(content: string, sourceUrl: string, sourceRef: string): ImportedSkill {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
      // No frontmatter — use content as-is
      return { name: 'unnamed-skill', description: '', content, sourceUrl, sourceRef }
    }

    const frontmatter = match[1]
    const body = match[2].trim()

    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'unnamed-skill'
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ''

    return { name, description, content: body, sourceUrl, sourceRef }
  }

  // Main import method
  async importFromUrl(url: string): Promise<ImportedSkill[]> {
    const parsed = this.parseUrl(url)
    const skills: ImportedSkill[] = []

    if (parsed.type === 'file') {
      // Single file
      const content = await this.fetchFile(parsed.owner, parsed.repo, parsed.path, parsed.branch)
      skills.push(this.parseSkillFile(content, url, parsed.branch))
    } else {
      // Directory or repo — look for SKILL.md files
      const searchPath = parsed.path || ''
      const entries = await this.listDir(parsed.owner, parsed.repo, searchPath, parsed.branch)

      // Check for SKILL.md directly in this folder
      const skillFile = entries.find(e => e.name === 'SKILL.md')
      if (skillFile) {
        const content = await this.fetchFile(parsed.owner, parsed.repo, skillFile.path, parsed.branch)
        skills.push(this.parseSkillFile(content, url, parsed.branch))
      }

      // Check subdirectories for SKILL.md
      const dirs = entries.filter(e => e.type === 'dir')
      for (const dir of dirs) {
        try {
          const subEntries = await this.listDir(parsed.owner, parsed.repo, dir.path, parsed.branch)
          const subSkill = subEntries.find(e => e.name === 'SKILL.md')
          if (subSkill) {
            const content = await this.fetchFile(parsed.owner, parsed.repo, subSkill.path, parsed.branch)
            skills.push(this.parseSkillFile(content, `${url}/${dir.name}`, parsed.branch))
          }
        } catch {
          // Skip directories that fail
        }
      }
    }

    if (skills.length === 0) {
      throw new Error('No SKILL.md files found at this URL')
    }

    return skills
  }
}
```

### 2c. Backend — `packages/api/src/routes/skills.ts`

Adicionar dois novos endpoints:

```typescript
import { SkillImporter } from '../services/SkillImporter.js'

// Import skills from GitHub URL
app.post('/api/skills/import', { preHandler: [adminOnly] }, async (req, reply) => {
  const { url } = req.body as { url: string }
  if (!url?.trim()) return reply.status(400).send({ error: 'URL is required' })

  const githubToken = process.env['GITHUB_TOKEN']
    ?? (db.prepare("SELECT value FROM setup_state WHERE key = 'github_token'").get() as any)?.value
    ?? undefined

  const importer = new SkillImporter(githubToken)

  try {
    const imported = await importer.importFromUrl(url.trim())
    const created = []

    for (const skill of imported) {
      // Check for existing skill with same name
      const existing = db.prepare('SELECT id FROM skills WHERE name = ?').get(skill.name) as any
      if (existing) {
        // Update existing
        db.prepare(`
          UPDATE skills SET description = ?, content = ?, source = 'github', source_url = ?, source_ref = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(skill.description, skill.content, skill.sourceUrl, skill.sourceRef, existing.id)
        created.push({ id: existing.id, name: skill.name, action: 'updated' })
      } else {
        // Create new
        const id = randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO skills (id, name, description, content, source, source_url, source_ref, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'github', ?, ?, ?, ?)
        `).run(id, skill.name, skill.description, skill.content, skill.sourceUrl, skill.sourceRef, now, now)
        created.push({ id, name: skill.name, action: 'created' })
      }
    }

    return reply.send({ imported: created })
  } catch (err: any) {
    return reply.status(400).send({ error: err.message })
  }
})

// Preview import (fetch and parse without saving)
app.post('/api/skills/import/preview', { preHandler: [adminOnly] }, async (req, reply) => {
  const { url } = req.body as { url: string }
  if (!url?.trim()) return reply.status(400).send({ error: 'URL is required' })

  const githubToken = process.env['GITHUB_TOKEN']
    ?? (db.prepare("SELECT value FROM setup_state WHERE key = 'github_token'").get() as any)?.value
    ?? undefined

  const importer = new SkillImporter(githubToken)

  try {
    const skills = await importer.importFromUrl(url.trim())
    return reply.send({
      skills: skills.map(s => ({
        name: s.name,
        description: s.description,
        contentPreview: s.content.slice(0, 200) + (s.content.length > 200 ? '...' : ''),
        exists: !!db.prepare('SELECT 1 FROM skills WHERE name = ?').get(s.name),
      })),
    })
  } catch (err: any) {
    return reply.status(400).send({ error: err.message })
  }
})
```

### 2d. Frontend — API client `packages/web/src/api/client.ts`

Adicionar ao objeto `skills`:

```typescript
importFromGithub: (url: string) => request<{ imported: Array<{ id: string; name: string; action: string }> }>('/skills/import', { method: 'POST', body: JSON.stringify({ url }) }),
previewImport: (url: string) => request<{ skills: Array<{ name: string; description: string; contentPreview: string; exists: boolean }> }>('/skills/import/preview', { method: 'POST', body: JSON.stringify({ url }) }),
```

### 2e. Frontend — `packages/web/src/pages/SkillsListPage.tsx`

Adicionar botão "Import from GitHub" ao lado do "New Skill", que abre um modal:

**Import Modal:**
- Input: GitHub URL (placeholder: `github.com/user/repo/tree/main/skills`)
- Botão "Preview" → chama preview endpoint → mostra lista de skills encontradas com:
  - Nome, descrição, preview do conteúdo
  - Badge "new" ou "update" (se já existe com mesmo nome)
- Botão "Import All" → chama import endpoint
- Toast de sucesso: "Imported X skills"
- Refresh da lista

```tsx
import { Download } from 'lucide-react'

// State:
const [importOpen, setImportOpen] = useState(false)
const [importUrl, setImportUrl] = useState('')
const [importPreview, setImportPreview] = useState<any[] | null>(null)
const [importing, setImporting] = useState(false)
const [previewing, setPreviewing] = useState(false)
const [importError, setImportError] = useState('')

// Handlers:
async function handlePreview() {
  setPreviewing(true); setImportError(''); setImportPreview(null)
  try {
    const result = await api.skills.previewImport(importUrl)
    setImportPreview(result.skills)
  } catch (err: any) { setImportError(err.message) }
  finally { setPreviewing(false) }
}

async function handleImport() {
  setImporting(true); setImportError('')
  try {
    await api.skills.importFromGithub(importUrl)
    setImportOpen(false); setImportUrl(''); setImportPreview(null)
    fetchSkills()
  } catch (err: any) { setImportError(err.message) }
  finally { setImporting(false) }
}
```

**No JSX** — botão ao lado do "New Skill":
```tsx
<Button variant="secondary" onClick={() => setImportOpen(true)}>
  <Download size={16} className="mr-1.5" />
  Import from GitHub
</Button>
```

**Modal:**
```tsx
<Modal open={importOpen} onClose={() => { setImportOpen(false); setImportPreview(null); setImportError('') }} title="Import Skills from GitHub">
  <div className="space-y-4">
    <Input
      label="GitHub URL"
      value={importUrl}
      onChange={(e) => setImportUrl(e.target.value)}
      placeholder="github.com/user/repo or github.com/user/repo/tree/main/skills"
    />

    {importError && (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-destructive)] p-3 text-sm text-[var(--color-destructive)]">
        {importError}
      </div>
    )}

    {importPreview && (
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          Found {importPreview.length} skill(s):
        </p>
        {importPreview.map((s, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{s.name}</span>
              <Badge variant={s.exists ? 'warning' : 'success'}>{s.exists ? 'update' : 'new'}</Badge>
            </div>
            <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mt-1">{s.description}</p>
          </div>
        ))}
      </div>
    )}

    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={() => { setImportOpen(false); setImportPreview(null) }}>
        Cancel
      </Button>
      {!importPreview ? (
        <Button onClick={handlePreview} loading={previewing} disabled={!importUrl.trim()}>
          Preview
        </Button>
      ) : (
        <Button onClick={handleImport} loading={importing}>
          Import {importPreview.length} Skill(s)
        </Button>
      )}
    </div>
  </div>
</Modal>
```

### 2f. Upload de skill file

No `SkillEditorPage.tsx`, adicionar opção de upload de um arquivo `.md`:

Acima do textarea de Content, adicionar:

```tsx
<div className="flex items-center gap-2">
  <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Content</label>
  <label className="text-[11px] text-[var(--color-primary)] hover:underline cursor-pointer">
    <input
      type="file"
      accept=".md"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const text = await file.text()
        // Parse frontmatter if present
        const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
        if (match) {
          const fm = match[1]
          const body = match[2].trim()
          const parsedName = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim()
          const parsedDesc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim()
          if (parsedName && !name) setName(parsedName)
          if (parsedDesc && !description) setDescription(parsedDesc)
          setContent(body)
        } else {
          setContent(text)
        }
      }}
    />
    Upload .md file
  </label>
</div>
```

### 2g. Skills list — mostrar source badge

Na tabela de skills (`SkillsListPage.tsx`), adicionar uma coluna "Source" com badge:

```tsx
// Na table header:
<th>Source</th>

// Na table row:
<td>
  <Badge variant={skill.source === 'github' ? 'info' : 'neutral'}>
    {skill.source ?? 'manual'}
  </Badge>
</td>
```

### 2h. Shared types — `packages/shared/src/types/skill.ts`

Verificar se o tipo `Skill` tem os novos campos. Adicionar se necessário:

```typescript
export interface Skill {
  id: string
  name: string
  description: string | null
  content: string
  source?: 'manual' | 'github' | 'upload'
  sourceUrl?: string | null
  sourceRef?: string | null
  createdAt: string
  updatedAt: string
}
```

### 2i. BackupService

Adicionar os novos campos de `skills` (source, source_url, source_ref) — como são ALTER TABLE nas colunas existentes, já são incluídos automaticamente no dump da tabela skills.

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **Componentes UI**: usar `Button`, `Input`, `Modal`, `Badge`, `Textarea` de `@/components/ui/`
4. **DB síncrono**: better-sqlite3
5. **GitHub API**: usar fetch direto (não gh CLI), autenticar com GITHUB_TOKEN se disponível
6. **SKILL.md format**: frontmatter YAML com `name` e `description`, body como conteúdo da skill — compatível com Claude Code skills
7. **Duplicatas**: se skill com mesmo name já existe, fazer UPDATE (não criar duplicata)
8. **Hierarquia**: se parent foi selecionado no setup, vincular; se não, agent fica root

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Setup wizard Step 4 → selecionar agents → verificar em /agents que hierarquia está correta (tech-lead como pai)
2. Org Chart (/agents/org) mostra árvore hierárquica
3. Skills → Import from GitHub → colar URL de repo com SKILL.md → Preview → Import
4. Skill importada aparece na lista com badge "github"
5. Re-importar mesma URL → atualiza skills existentes (badge "update" no preview)
6. Skill editor → Upload .md → preenche name/description/content do frontmatter
7. Import de URL inválida mostra erro amigável
