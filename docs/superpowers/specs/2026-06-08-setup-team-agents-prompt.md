# Prompt: Adicionar Step 4 "Dev Team" ao Setup Wizard

Adicionar um passo no setup wizard para criar o time de agentes de desenvolvimento. Os agents são criados a partir dos arquivos `.md` em `agents/`. O usuário seleciona quais quer via checkboxes agrupados por tier.

Leia os arquivos referenciados antes de editar.

## Contexto

- Setup wizard atual tem 3 steps: Admin Account → LLM Provider → GitHub Token
- Adicionar **Step 4: Dev Team** antes do "Complete Setup"
- Agent definitions existem em `agents/*.md` com frontmatter YAML (name, description, model, color)
- Agents são criados via INSERT na tabela `agents` (campos: id, name, role, instructions, provider_id, model)
- O provider criado no Step 2 pode ser vinculado aos agents automaticamente

## Arquivos a modificar

### 1. Backend — `packages/api/src/routes/setup.ts`

Adicionar campo `agents` ao body do `POST /api/setup/complete`:

```typescript
const { admin, providers, githubToken, agents } = req.body as {
  admin: { name: string; email: string; password: string }
  providers?: Array<{ name: string; type: string; configJson: Record<string, unknown> }>
  githubToken?: string
  agents?: Array<{ name: string; role: string; instructions: string; model: string }>
}
```

Dentro da transaction, após criar providers, criar agents:

```typescript
// Create agents if any
if (agents?.length) {
  // Use the first provider created (if any) as default
  const firstProvider = providers?.length
    ? db.prepare('SELECT id FROM providers ORDER BY created_at DESC LIMIT 1').get() as any
    : null

  for (const a of agents) {
    db.prepare(`
      INSERT INTO agents (id, name, role, instructions, provider_id, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), a.name, a.role, a.instructions, firstProvider?.id ?? null, a.model)
  }
}
```

### 2. Backend — Novo endpoint `GET /api/setup/agent-templates`

Adicionar ao `packages/api/src/routes/setup.ts` um endpoint que lê os `.md` do diretório `agents/` e retorna os templates disponíveis:

```typescript
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

app.get('/api/setup/agent-templates', async (_req, reply) => {
  const agentsDir = process.env['AGENTS_DIR'] ?? 'agents'
  const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'))

  const templates = files.map(file => {
    const content = readFileSync(join(agentsDir, file), 'utf-8')
    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return null

    const frontmatter = match[1]
    const body = match[2].trim()

    // Simple YAML parse for known fields
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? file.replace('.md', '')
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ''
    const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1]?.trim() ?? 'claude-sonnet-4-6'
    const color = frontmatter.match(/^color:\s*(.+)$/m)?.[1]?.trim() ?? 'gray'

    return { name, description, model, color, instructions: body }
  }).filter(Boolean)

  return reply.send(templates)
})
```

Este endpoint é **público** (adicionar `GET /api/setup/agent-templates` ao `PUBLIC_ROUTES` em `middleware/auth.ts`) pois é chamado durante o setup antes do login.

### 3. Frontend — `packages/web/src/pages/SetupPage.tsx`

**Mudanças:**

**3a) Atualizar steps de 3 para 4:**

```typescript
const steps = ['Admin Account', 'LLM Provider', 'GitHub Token', 'Dev Team']
```

**3b) Adicionar state para agents:**

```typescript
interface AgentTemplate {
  name: string
  description: string
  model: string
  color: string
  instructions: string
}

// Dentro do componente:
const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([])
const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())

// Carregar templates ao montar
useEffect(() => {
  fetch('/api/setup/agent-templates')
    .then(r => r.json())
    .then((templates: AgentTemplate[]) => {
      setAgentTemplates(templates)
      // Pre-select Tier 1 (core team)
      const coreTeam = new Set(['tech-lead', 'triage-agent', 'qa-lead'])
      setSelectedAgents(coreTeam)
    })
}, [])
```

**3c) Definir tiers para agrupamento visual:**

```typescript
const TIERS = [
  {
    label: 'Core Team',
    hint: 'Recommended for all projects',
    agents: ['tech-lead', 'triage-agent', 'qa-lead'],
  },
  {
    label: 'Specialists',
    hint: 'Select based on your stack',
    agents: ['backend-lead', 'frontend-lead', 'database-agent', 'devops-agent', 'security-agent'],
  },
  {
    label: 'Executors',
    hint: 'For automated implementation',
    agents: ['api-agent', 'ui-agent', 'test-agent', 'integration-agent'],
  },
]
```

Agents que existem nos `.md` mas não estão em nenhum tier (ex: gaud-fiscal, tributos-brasil, gaud-nfse-*) ficam de fora — são agentes de nicho que o user pode adicionar manualmente depois.

**3d) Renderizar Step 4:**

```tsx
{step === 4 && (
  <div className="flex flex-col gap-4">
    <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
      Select the AI agents for your development team. You can add more later in Settings.
    </p>
    {TIERS.map(tier => {
      const tierAgents = agentTemplates.filter(a => tier.agents.includes(a.name))
      if (tierAgents.length === 0) return null
      return (
        <div key={tier.label}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              {tier.label}
            </span>
            <span className="text-[11px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {tier.hint}
            </span>
          </div>
          <div className="space-y-1.5">
            {tierAgents.map(agent => (
              <label
                key={agent.name}
                className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-3 py-2 cursor-pointer hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-elevated-dark)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAgents.has(agent.name)}
                  onChange={(e) => {
                    const next = new Set(selectedAgents)
                    e.target.checked ? next.add(agent.name) : next.delete(agent.name)
                    setSelectedAgents(next)
                  }}
                  className="mt-0.5 rounded"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                    {agent.name}
                  </span>
                  <p className="text-[11px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] truncate">
                    {agent.description}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] shrink-0">
                  {agent.model}
                </span>
              </label>
            ))}
          </div>
        </div>
      )
    })}
    {/* Quick actions */}
    <div className="flex gap-2 text-[11px]">
      <button
        type="button"
        onClick={() => setSelectedAgents(new Set(agentTemplates.filter(a => TIERS.some(t => t.agents.includes(a.name))).map(a => a.name)))}
        className="text-[var(--color-primary)] hover:underline cursor-pointer"
      >
        Select All
      </button>
      <button
        type="button"
        onClick={() => setSelectedAgents(new Set())}
        className="text-[var(--color-muted)] hover:underline cursor-pointer"
      >
        Clear
      </button>
    </div>
  </div>
)}
```

**3e) Atualizar handleComplete para incluir agents:**

```typescript
// Após githubToken:
if (selectedAgents.size > 0) {
  data.agents = agentTemplates
    .filter(a => selectedAgents.has(a.name))
    .map(a => ({
      name: a.name,
      role: a.description,
      instructions: a.instructions,
      model: a.model,
    }))
}
```

**3f) Ajustar navegação dos botões:**

Agora são 4 steps em vez de 3:

- Steps 2, 3, 4 têm botão Skip
- Step 4 tem "Complete Setup" e "Skip" (skip finaliza sem agents)
- Atualizar todas as referências de `step < 3` para `step < 4` e `step === 3` para `step === 4`

Especificamente:

```typescript
// O handleComplete é chamado no step 4 (era 3)
// Next vai até step 4
// Skip no step 2 → step 3, Skip no step 3 → step 4, Skip no step 4 → handleComplete

// Actions section:
<div className="flex gap-2">
  {step >= 2 && (
    step < 4 ? (
      <Button variant="secondary" onClick={() => { setError(''); setStep(step + 1) }}>
        Skip
      </Button>
    ) : (
      <Button variant="secondary" onClick={handleComplete} disabled={loading}>
        Skip
      </Button>
    )
  )}
  {step < 4 ? (
    <Button onClick={next}>Next</Button>
  ) : (
    <Button onClick={handleComplete} loading={loading}>
      Complete Setup
    </Button>
  )}
</div>
```

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **Componentes UI**: usar `Button`, `Input` de `@/components/ui/`
4. **PUBLIC_ROUTES**: adicionar `GET /api/setup/agent-templates` em `middleware/auth.ts`
5. **Agents de nicho** (gaud-fiscal, gaud-nfse-*, tributos-brasil, gaud-sefaz-*): não incluir nos tiers, ficam ocultos no setup
6. **Tier 1 pré-selecionado** por padrão: tech-lead, triage-agent, qa-lead
7. **Provider linking**: agents criados no setup usam o provider criado no Step 2 como default

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Reset do setup (DELETE do volume docker ou limpar setup_state)
2. Steps 1-3 funcionam como antes
3. Step 4 mostra agents agrupados por tier, Tier 1 pré-selecionado
4. "Select All" e "Clear" funcionam
5. Complete Setup cria admin + provider + agents selecionados
6. Agents aparecem em `/agents` com provider vinculado
7. Skip no Step 4 cria sem agents
