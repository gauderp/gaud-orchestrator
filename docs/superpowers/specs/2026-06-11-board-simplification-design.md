# Spec: Simplificação dos Boards + Fontes de Bugs Plugáveis

**Data:** 2026-06-11
**Status:** draft

## 1. Problema

O mesmo trabalho tem estado representado em 3–4 lugares que precisam ser sincronizados manualmente:

| Entidade | Estados próprios hoje |
|---|---|
| `bug_reports.status` | new, triaging, needs_info, triaged, rejected |
| Card no board de bugs | New, Triaging, Triaged, In Progress, Testing, Reopened, Done |
| `specs.status` | draft, review, approved, rejected (fora de qualquer board) |
| `executions.status` | planning, approving, executing, done, failed |
| `execution_tasks.status` | pending, running, done, failed, paused |

Cada estado duplicado gera código de sincronização (ex: `bug-triage.ts` atualiza `bug_reports.status` E move o card). Além disso, dois paradigmas de board convivem: boards genéricos configuráveis (`agent_action_prompt`, `auto_move`, `role_required` por coluna) e o board fixo de bugs com IDs hardcoded.

## 2. Princípio central

> **A coluna do card é a ÚNICA fonte de verdade do estado do trabalho.**

- Bug report, spec e execução deixam de ter `status` próprio — viram **conteúdo anexado ao card**.
- A entrevista de triagem é uma conversa do card. A spec é um artefato do card. A execução é um run log do card.
- Mover o card = mudar o estado. Nada para sincronizar.
- Os 3 boards são **fixos** (IDs constantes, criados por migration). Sem CRUD de boards/colunas para o usuário.

## 3. Os 3 boards

```
TRIAGE     New → Interviewing → Triaged ─┬→ (bug confirmado) ───────→ DEV: To Do
           └→ Rejected                   └→ (na verdade é feature) ─→ SPEC: Ideas

SPEC       Ideas → Drafting → Review → Approved
                                          └→ decompõe em N cards filhos → DEV: To Do

DEV        To Do → In Progress → Review → Done
```

### 3.1 Board Triage (`triage-board`)

| Coluna | ID | Significado | Quem move |
|---|---|---|---|
| New | `triage-col-new` | Bug chegou (qualquer fonte), ninguém olhou | criação automática |
| Interviewing | `triage-col-interviewing` | LLM entrevistando o reporter / coletando contexto | botão "Start Triage" |
| Triaged | `triage-col-triaged` | Entrevista concluída, `triage_summary` + `severity` preenchidos | agente ao concluir |
| Rejected | `triage-col-rejected` | Não é bug / duplicado / won't fix | agente (com aprovação) ou usuário |

- **Sem** In Progress / Testing / Reopened / Done. Trabalho de desenvolvimento acontece no board Dev.
- "Aguardando resposta do usuário" (antigo `needs_info`) **não é coluna**: deriva de `conversations.status = 'paused_for_user'` e aparece como badge no card em Interviewing.
- **Handoff:** de Triaged, ação "Send to Development" move o card (muda `board_id` + `column_id`) para Dev: To Do. Se a triagem concluir que é feature request, ação "Send to Spec" move para Spec: Ideas (o card muda `type` de `bug` para `task`).
- Bug reaberto = card volta de Dev: Done para Dev: To Do (comentário automático registra a reabertura). Sem coluna Reopened.

### 3.2 Board Spec (`spec-board`)

| Coluna | ID | Significado |
|---|---|---|
| Ideas | `spec-col-ideas` | Ideia capturada, sem spec ainda |
| Drafting | `spec-col-drafting` | LLM escrevendo a spec junto com o usuário (conversa do card) |
| Review | `spec-col-review` | Spec pronta para revisão humana/agente |
| Approved | `spec-col-approved` | Aprovada — pode ser decomposta |

- A tabela `specs` **perde** `status` (a coluna do card já diz). Ganha `card_id NOT NULL` — toda spec pertence a um card do board Spec. Mantém `version` e `content`.
- `spec_reviews` continua como registro de vereditos, mas o veredito `approve`/`reject` **move o card** (Review → Approved, ou Review → Drafting) em vez de setar status.
- **Decomposição:** em Approved, ação "Break into tasks" (usa o `spec-decomposer` existente) cria N cards `type=task` em Dev: To Do com `parent_card_id` apontando para o card da spec. O card da spec permanece em Approved como "pai".
- Páginas SpecStudio/SpecReview viram a visão de detalhe do card do board Spec (mesma lógica do bug: card clicado abre a página rica).

### 3.3 Board Dev (`dev-board`)

| Coluna | ID | Significado |
|---|---|---|
| To Do | `dev-col-todo` | Pronto para execução (veio de triagem, de spec decomposta, ou criado à mão) |
| In Progress | `dev-col-progress` | Agente (ou humano) trabalhando |
| Review | `dev-col-review` | PR aberto, aguardando revisão |
| Done | `dev-col-done` | Mergeado/concluído |

- `execution_tasks` **deixa de existir** — cada task de execução É um card neste board.
- `executions` vira **run log** do card: `id, card_id, started_at, finished_at, outcome ('success'|'failed'), pr_url, branch`. Um card pode ter N runs (retries). Sem máquina de estado: enquanto roda, `finished_at IS NULL` e o card está em In Progress.
- A execution-engine passa a operar sobre cards: pega card em To Do → move para In Progress → executa → abre PR → move para Review. Falha = card volta para To Do com comentário do erro + run com `outcome='failed'`.

## 4. Fontes de bugs plugáveis

### 4.1 Tabela `bug_sources`

Segue o padrão já existente de `providers` (tipo + config JSON):

```sql
CREATE TABLE bug_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                -- "Bugsnag Produção", "Trello Suporte"
  type TEXT NOT NULL,                -- 'bugsnag' | 'trello' | 'generic' (extensível, SEM CHECK)
  config_json TEXT NOT NULL DEFAULT '{}',
  webhook_secret TEXT NOT NULL,      -- token gerado na criação, usado na URL do webhook
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

As fontes internas (`ui`, `slack`, `mcp`) continuam funcionando como hoje, sem registro em `bug_sources` — esta tabela é só para fontes externas via webhook.

### 4.2 Mudanças em `bug_reports`

- **Remover** `status` (deriva da coluna do card) e o CHECK de `source`.
- `source` vira TEXT livre (`ui`, `slack`, `mcp`, `bugsnag`, `trello`, ...).
- Adicionar: `source_id TEXT REFERENCES bug_sources(id)`, `external_id TEXT`, `external_url TEXT`.
- Dedup: `CREATE UNIQUE INDEX idx_bug_reports_external ON bug_reports(source_id, external_id) WHERE external_id IS NOT NULL` — webhook repetido atualiza o report existente em vez de criar outro.

### 4.3 Endpoint de intake + adapters

```
POST /api/intake/bugs/:sourceId?token=<webhook_secret>
```

- Rota **pública** (webhooks não autenticam via JWT); valida `token` contra `webhook_secret` da fonte e `enabled = 1`.
- O adapter do `type` da fonte normaliza o payload bruto para o formato comum:

```typescript
interface NormalizedBugIntake {
  title: string
  description: string        // corpo formatado (stacktrace, contexto, link original)
  externalId?: string        // id no sistema de origem (dedup)
  externalUrl?: string       // link para o item original
  severity?: 'critical' | 'high' | 'medium' | 'low'
  reporterName?: string
  reporterEmail?: string
}

interface BugSourceAdapter {
  type: string
  verify(req: FastifyRequest, source: BugSource): boolean  // assinatura/secret específico
  normalize(payload: unknown, source: BugSource): NormalizedBugIntake | null  // null = ignorar evento
}
```

- Adapters ficam em `packages/api/src/intake/` num registry (`Map<type, adapter>`). Adicionar fonte nova = adicionar um arquivo + registrar.
- Após normalizar, o fluxo é o mesmo do bug manual: cria `bug_report` + card em Triage: New + conversa vazia.

**Adapters iniciais:**

| Adapter | Evento | Mapeamento |
|---|---|---|
| `generic` | qualquer POST JSON | espera o próprio formato `NormalizedBugIntake` — serve para integrações custom/curl |
| `bugsnag` | webhook de erro (trigger `firstException`/`reopened`) | `title` = `error.exceptionClass: error.message`, `description` = contexto + stacktrace resumido + `error.url`, `externalId` = `error.errorId`, `severity` mapeada de `error.severity` |
| `trello` | webhook de board (card criado/movido para lista configurada em `config_json.listId`) | `title` = nome do card, `description` = desc do card + link, `externalId` = id do card Trello. `verify` usa HMAC-SHA1 do Trello |

- Trello exige resposta 200 a um HEAD/GET de validação no registro do webhook — o endpoint aceita `HEAD`/`GET` retornando 200.
- UI: página simples de configuração (listar/criar/desabilitar fontes, mostrar URL do webhook pronta para copiar). Sem editor de mapeamento — mapeamento é código (adapter).

## 5. O que muda / o que morre

### Migrations (uma migration `011_simplify_boards.sql` + código)

1. Criar boards/colunas fixos `triage-board`, `spec-board`, `dev-board` (INSERT OR IGNORE, padrão da 010).
2. Migrar cards: bug board antigo → Triage (New/Triaging→Interviewing, Triaged→Triaged); colunas In Progress/Testing/Reopened/Done do bug board → Dev (In Progress→In Progress, Testing→Review, Reopened→To Do, Done→Done). Boards "Development" criados via setup → Dev board fixo (Backlog+To Do→To Do, demais 1:1).
3. Para cada `spec` existente: criar card no Spec board na coluna correspondente ao status atual, setar `specs.card_id`.
4. Recriar `bug_reports` sem `status`/CHECK de source, com novos campos (SQLite: create new + copy + drop + rename).
5. Recriar `specs` sem `status`, com `card_id`.
6. `executions`: recriar como run log (manter histórico mapeando status→outcome); **dropar** `execution_tasks`, `execution_gaps` (gaps viram mensagens `question_for_user` na conversa do card).
7. Dropar colunas `agent_action_prompt`, `auto_move`, `role_required` de `columns` (motor genérico de workflow morre).
8. **Deletar boards legados** após a migração dos cards: `bug-triage-board` (e suas colunas `bug-col-*`), boards "Development" criados via setup e qualquer outro board user-created cujos cards foram movidos. Ao final, devem existir SOMENTE os 3 boards fixos. Verificação na migration: `SELECT COUNT(*) FROM boards` deve retornar 3, e nenhum card pode apontar para coluna inexistente (`SELECT COUNT(*) FROM cards WHERE column_id NOT IN (SELECT id FROM columns)` = 0).

### Código a remover/simplificar

| Item | Ação |
|---|---|
| `BUG_COLUMNS` em `constants.ts` | substituir por `TRIAGE_COLUMNS`, `SPEC_COLUMNS`, `DEV_COLUMNS` + `BOARD_IDS` |
| `SPEC_STATUSES`, `EXECUTION_STATUSES` | remover |
| CRUD de boards/colunas (`boards.ts` POST/PUT/DELETE, `BoardSettingsPage`) | remover — boards são fixos; sobra GET |
| `column-action.ts` (agent_action_prompt) | remover |
| Sincronização status↔coluna em `bug-triage.ts` e `bug-reports.ts` | remover — só mover card |
| Setup (`setup.ts`) cria board Development | remover — migration cria os 3 fixos |
| `BoardListPage` | vira navegação fixa: Triage / Spec / Dev |

### Congelar (fora de escopo, não deletar agora)

Hierarquia project/epic (manter só `task`/`bug` na UI), GanttViewPage, OrgChartPage, memória de agente com embeddings, learning-detector. Não recebem manutenção até o core estar estável.

## 6. Fluxos ponta a ponta (validação da spec)

1. **Bugsnag → produção:** erro novo no Bugsnag → webhook → adapter normaliza → `bug_report` + card em Triage: New → usuário clica Start Triage → card vai a Interviewing, LLM entrevista (com stacktrace do payload como contexto) → Triaged → "Send to Development" → Dev: To Do → engine executa → In Progress → PR aberto → Review → merge → Done.
2. **Feature nova:** usuário cria card em Spec: Ideas → move para Drafting → conversa com LLM escreve a spec (artefato versionado em `specs`) → Review → aprovação move para Approved → "Break into tasks" → N cards em Dev: To Do com `parent_card_id` → execução individual.
3. **Bug reaberto:** card em Dev: Done volta para Dev: To Do; novo run registrado no mesmo card; histórico de runs preservado em `executions`.

## 7. Critérios de aceite

- [ ] Nenhuma tabela de domínio tem coluna `status` que duplique a coluna do card (`bug_reports`, `specs`, `execution_tasks` eliminados ou sem status).
- [ ] Os 3 boards existem após migration em banco zerado E em banco existente (cards migrados sem perda).
- [ ] POST no webhook genérico com payload válido cria card em Triage: New; POST repetido com mesmo `externalId` não duplica.
- [ ] Adapter Bugsnag e Trello cobertos por testes unitários de `normalize` com payloads reais de exemplo.
- [ ] Mover card entre colunas/boards pela UI é a única forma de mudar estado; `/bugs` lista a partir dos cards do Triage board.
- [ ] Usuário não consegue criar/excluir boards ou colunas.
- [ ] Após a migration em banco existente: existem exatamente 3 boards, zero cards órfãos, e as tabelas `execution_tasks` e `execution_gaps` não existem mais.
- [ ] Nenhuma referência morta no código: `grep` por `BUG_COLUMNS`, `SPEC_STATUSES`, `EXECUTION_STATUSES`, `agent_action_prompt`, `auto_move`, `role_required`, `execution_tasks` não retorna ocorrências fora de migrations antigas.
