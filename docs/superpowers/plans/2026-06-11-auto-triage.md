# Auto-Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bugs que chegam por fontes automáticas (webhook generic/Bugsnag em `bug_sources`, Trello target=bugs em `trello_integrations`) podem disparar a triagem por LLM automaticamente — sem clique manual em "Start Triage". O card entra em Triage: New, a LLM analisa e o card sai em Triaged (ou Rejected) sozinho.

**Arquitetura:** Uma coluna `auto_triage_agent_id` (FK para `agents`, NULL = desativado) em `bug_sources` e `trello_integrations`. Quando preenchida, o handler do webhook dispara `BugTriageService.startTriage()` em background logo após criar o bug report — em modo **noReporter**: o prompt instrui o agente a NÃO fazer perguntas e concluir com a informação disponível.

**Depende de:** integração Trello na main (commit `2732e37` com os 3 fixes da revisão).

## Decisões de design

| Decisão | Default |
|---|---|
| Modo do prompt para fontes automáticas | `noReporter` SEMPRE — não há humano na conversa para responder; o agente conclui [TRIAGED]/[REJECTED] com o que tem. Sem needs_info/paused_for_user |
| Backfill do Trello | **NÃO dispara auto-triagem** — importar 50 bugs não pode virar 50 chamadas LLM. Só eventos de webhook (bug novo, um por vez) |
| Falha na triagem automática | Card permanece em Triage: New (estado atual de erro do startTriage já faz rollback) — triagem manual continua disponível como fallback |
| Agente sem provider configurado | Criação/edição da fonte valida que o agente tem provider; se em runtime não tiver, loga erro e segue (card fica em New) |

**Padrões obrigatórios do codebase:** db injetado (`(app as any).db ?? getDb()`), `toCamelCase` nas respostas, imports com `.js`, `requireRole('editor')` em mutações, **rodar `pnpm -r test` antes de declarar concluído** (não só typecheck).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/api/src/db/migrations/014_auto_triage.sql` | Colunas auto_triage_agent_id nas duas tabelas |
| Modify | `packages/api/src/services/bug-triage.ts` | Opção `noReporter` no startTriage |
| Modify | `packages/api/src/routes/intake.ts` | Disparo após criar report (bug_sources) |
| Modify | `packages/api/src/routes/trello-webhook.ts` | Disparo após evento 'created' em target bugs |
| Modify | `packages/api/src/routes/bug-sources.ts` + `trello-integrations.ts` | Aceitar/retornar autoTriageAgentId; validar agente |
| Modify | shared types (`bug-source.ts`, `trello.ts`) | Campo novo |
| Modify | `packages/web/src/pages/BugSourcesPage.tsx` + `TrelloIntegrationsPage.tsx` | Select "Auto-triage agent (optional)" |
| Create/Modify | testes | Gatilho disparado/não disparado; prompt noReporter |

---

### Task 1: Migration 014

- [ ] **Step 1:**

```sql
-- Migration 014: auto-triage for automatic bug sources
ALTER TABLE bug_sources ADD COLUMN auto_triage_agent_id TEXT REFERENCES agents(id);
ALTER TABLE trello_integrations ADD COLUMN auto_triage_agent_id TEXT REFERENCES agents(id);
```

- [ ] **Step 2:** Boot do servidor aplica + backup automático. Commit.

---

### Task 2: Modo noReporter no BugTriageService

**File:** `packages/api/src/services/bug-triage.ts`

- [ ] **Step 1:** Assinatura: `startTriage(reportId, triageAgentId, providerRegistry, opts?: { noReporter?: boolean })`.
- [ ] **Step 2:** Quando `opts.noReporter`, anexar ao `triagePrompt` (após a linha "Analyze this bug report..."):

```
IMPORTANT: This report came from an automated source. There is NO human reporter available to answer questions. Do NOT ask clarifying questions — produce your best [TRIAGED] or [REJECTED] verdict using only the information above. If information is missing, state your assumptions explicitly in the triage summary.
```

- [ ] **Step 3:** Teste unitário: com noReporter, o prompt armazenado na conversa contém a instrução; sem a opção, não contém. Commit.

---

### Task 3: Disparo no intake (bug_sources)

**File:** `packages/api/src/routes/intake.ts`

- [ ] **Step 1:** A rota já cria reportId. Após o INSERT do bug_report (antes do reply):

```typescript
if (source.auto_triage_agent_id) {
  const providerRegistry = (app as any).providerRegistry
  const { BugTriageService } = await import('../services/bug-triage.js')
  new BugTriageService(db).startTriage(reportId, source.auto_triage_agent_id, providerRegistry, { noReporter: true })
    .catch((e: any) => app.log.error(`Auto-triage failed for ${reportId}: ${e.message}`))
}
```

Não bloquear a resposta do webhook (sem await no fluxo principal — fire-and-forget com catch).

- [ ] **Step 2:** Teste: POST no intake com source que tem auto_triage_agent_id → mockar/espiar BugTriageService e verificar chamada com noReporter; sem o campo → não chama. Commit.

---

### Task 4: Disparo no webhook Trello (target bugs)

**File:** `packages/api/src/routes/trello-webhook.ts`

- [ ] **Step 1:** Após `handleWebhookEvent` retornar `'created'` e `integration.target === 'bugs'` e `integration.auto_triage_agent_id`:
  - Localizar o card recém-criado: `SELECT id FROM cards WHERE integration_id = ? AND external_id = ?` (o external id vem de `req.body.action.data.card.id`).
  - Localizar o report: `SELECT id FROM bug_reports WHERE card_id = ?`.
  - Disparar `startTriage(reportId, integration.auto_triage_agent_id, providerRegistry, { noReporter: true })` fire-and-forget com catch (mesmo padrão da Task 3).
  - **Não tocar no backfill** — o disparo vive só na rota de webhook.
- [ ] **Step 2:** Teste: evento createCard em integração bugs com auto_triage_agent_id → triage chamada; evento 'updated'/'ignored' → não chamada; integração dev → não chamada. Commit.

---

### Task 5: CRUD + validação

**Files:** `bug-sources.ts`, `trello-integrations.ts`, shared types

- [ ] **Step 1:** POST/PUT das duas rotas aceitam `autoTriageAgentId` (nullable). Validar: se não-nulo, o agente existe E tem `provider_id` configurado (400 caso contrário).
- [ ] **Step 2:** Tipos shared: `autoTriageAgentId: string | null` em BugSource e TrelloIntegration. Commit.

---

### Task 6: Frontend

**Files:** `BugSourcesPage.tsx`, `TrelloIntegrationsPage.tsx`, `api/client.ts`

- [ ] **Step 1:** Nos forms de criação/edição: select "Auto-triage agent (optional)" populado por `api.agents.list()` (filtrar agentes com provider), opção default "None (manual triage)".
- [ ] **Step 2:** Na listagem, badge discreto "Auto-triage" quando configurado. Commit.

---

### Task 7: Verificação

- [ ] **Step 1:** `pnpm -r typecheck` + `pnpm -r test` — tudo verde.
- [ ] **Step 2:** Smoke local: seed de source generic com auto_triage_agent_id de um agente com provider real → POST no webhook → observar card ir New → Interviewing → Triaged sem interação, com triage_summary preenchido. (Requer provider configurado; se indisponível, verificar ao menos que o startTriage foi invocado e o card foi para Interviewing.)
- [ ] **Step 3:** Commit final.

---

## Fora de escopo (registrado)

- Botão "Triage all" para backfills em massa (fila sequencial com limite de custo) — futuro.
- Orçamento/limite de custo específico para auto-triagem (hoje vale o cost_limit do agente).
- Two-way sync com Trello: **descartado em definitivo** — a estratégia é o time migrar para o orquestrador quando ele estiver maduro, não manter os dois sincronizados.
