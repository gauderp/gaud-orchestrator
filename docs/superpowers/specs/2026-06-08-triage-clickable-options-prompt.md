# Prompt: Opções clicáveis na conversa de triage

Quando o agent de triage faz perguntas ao reporter (NEEDS_INFO), deve oferecer **opções de resposta clicáveis**. O user pode clicar numa opção OU digitar uma resposta livre.

Leia os arquivos referenciados antes de editar.

## Contexto

- O triage agent responde com `[NEEDS_INFO]` seguido de perguntas
- As perguntas devem incluir opções sugeridas no formato parseável
- O `ConversationView` renderiza mensagens e tem input de texto
- O `MessageBubble` renderiza cada mensagem individual
- A conversa de triage agora aparece inline na `BugReportDetailPage`

## Mudanças

### 1. Backend — Atualizar prompt de triage para incluir opções

**Arquivo: `packages/api/src/services/bug-triage.ts`**

Modificar a seção `[NEEDS_INFO]` do prompt para instruir o agent a incluir opções:

```typescript
**If you need more information from the reporter:**
[NEEDS_INFO]
Ask ONE question at a time in simple, non-technical language.
If the question has common answers, provide clickable options using this format:

[OPTIONS]
- Option text 1
- Option text 2
- Option text 3
[/OPTIONS]

The reporter can click an option or type a custom answer.

Example:
"Em qual navegador você está usando o sistema?"
[OPTIONS]
- Google Chrome
- Firefox
- Safari
- Microsoft Edge
- Não sei
[/OPTIONS]
```

### 2. Backend — Parser de opções no conversation-runner

**Arquivo: `packages/api/src/services/conversation-runner.ts`**

Adicionar parsing de `[OPTIONS]...[/OPTIONS]` no `parseAgentResponse`:

```typescript
export interface ParsedResponse {
  type: 'content' | 'question_for_user' | 'artifact'
  content: string
  mentions: string[]
  questionForUser: string | null
  artifact: string | null
  options: string[]  // NOVO
}
```

No `parseAgentResponse`, extrair opções:

```typescript
// Parse [OPTIONS]...[/OPTIONS] blocks
const options: string[] = []
const optionsMatch = raw.match(/\[OPTIONS\]\s*([\s\S]*?)\s*\[\/OPTIONS\]/i)
if (optionsMatch) {
  const optionsBlock = optionsMatch[1]!
  for (const line of optionsBlock.split('\n')) {
    const trimmed = line.trim().replace(/^-\s*/, '').trim()
    if (trimmed) options.push(trimmed)
  }
}

// Remove [OPTIONS]...[/OPTIONS] from content for clean display
const cleanContent = raw.replace(/\[OPTIONS\]\s*[\s\S]*?\[\/OPTIONS\]/gi, '').trim()
```

Incluir `options` no return de todos os paths do parser.

### 3. Backend — Persistir opções nas mensagens

As opções precisam ser armazenadas junto com a mensagem para que o frontend possa renderizá-las.

**Opção mais simples**: manter as opções no conteúdo da mensagem (o frontend parseia).

**Não criar nova coluna** — manter o bloco `[OPTIONS]...[/OPTIONS]` no `content` da mensagem. O frontend parseia na renderização. Isso é mais simples e não requer migration.

### 4. Frontend — Componente `OptionButtons`

**Arquivo: `packages/web/src/components/conversation/OptionButtons.tsx`**

Novo componente que parseia e renderiza opções clicáveis de uma mensagem:

```tsx
import { Button } from '@/components/ui/Button'

interface OptionButtonsProps {
  content: string           // raw message content containing [OPTIONS]...[/OPTIONS]
  onSelect: (option: string) => void
  disabled?: boolean
}

export function OptionButtons({ content, onSelect, disabled }: OptionButtonsProps) {
  // Parse [OPTIONS]...[/OPTIONS] from content
  const match = content.match(/\[OPTIONS\]\s*([\s\S]*?)\s*\[\/OPTIONS\]/i)
  if (!match) return null

  const options = match[1]!
    .split('\n')
    .map(line => line.trim().replace(/^-\s*/, '').trim())
    .filter(Boolean)

  if (options.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option, i) => (
        <button
          key={i}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-[13px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15 hover:border-[var(--color-primary)]/50 disabled:opacity-50 cursor-pointer dark:border-[var(--color-primary)]/20 dark:bg-[var(--color-primary)]/10 dark:hover:bg-[var(--color-primary)]/20"
        >
          {option}
        </button>
      ))}
    </div>
  )
}

// Helper to strip [OPTIONS]...[/OPTIONS] from content for clean display
export function stripOptions(content: string): string {
  return content.replace(/\[OPTIONS\]\s*[\s\S]*?\[\/OPTIONS\]/gi, '').trim()
}
```

### 5. Frontend — Integrar no `MessageBubble` ou `ConversationView`

**Arquivo: `packages/web/src/components/conversation/ConversationView.tsx`**

Importar e renderizar `OptionButtons` após a última mensagem do agent que contém opções:

```tsx
import { OptionButtons, stripOptions } from './OptionButtons'
```

Na renderização das mensagens, após cada `MessageBubble` de um agent:

```tsx
{conversation.messages.map((msg, idx) => {
  const isLastMessage = idx === conversation.messages.length - 1
  const hasOptions = msg.content.includes('[OPTIONS]')
  const isAgentMsg = msg.senderType === 'agent'

  return (
    <div key={msg.id}>
      <MessageBubble
        message={{ ...msg, content: stripOptions(msg.content) }}
        agentName={msg.senderId ? agentNames[msg.senderId] : undefined}
        agentColor={msg.senderId ? agentColors[msg.senderId] : undefined}
      />
      {/* Show clickable options only on the last agent message with options */}
      {isAgentMsg && hasOptions && isLastMessage && conversation.status !== 'completed' && (
        <div className="px-4 pb-2">
          <OptionButtons
            content={msg.content}
            onSelect={(option) => {
              sendMessage(conversation.id, option)
              setUserScrolled(false)
            }}
            disabled={conversation.status === 'completed'}
          />
        </div>
      )}
      {/* artifact block */}
      {msg.content.match(/\[ARTIFACT\]/i) && (
        <ArtifactBlock artifact={(msg.content.match(/\[ARTIFACT]\s*([\s\S]+)$/i)?.[1] ?? '').trim()} />
      )}
    </div>
  )
})}
```

**Regras para quando mostrar opções:**
- Apenas na **última mensagem** do agent (não nas anteriores)
- Apenas quando a conversa **não está completed**
- Quando o user clica numa opção, envia como mensagem normal (como se tivesse digitado)
- Após clicar, as opções desaparecem (mensagem do user é enviada, nova mensagem do agent vem)

### 6. Backend — Triage flow com opções

**Arquivo: `packages/api/src/services/bug-triage.ts`**

Modificar o prompt para que a conversa seja **uma pergunta por vez** (não todas de uma vez):

```typescript
const triagePrompt = `You are a bug triage agent having a conversation with the person who reported this bug.
Your goal is to gather enough information to classify the bug.

## Rules
1. Ask ONE question at a time — do not ask multiple questions at once
2. Use simple, non-technical language — the reporter may not be a developer
3. When the question has common answers, provide options using [OPTIONS]...[/OPTIONS] format
4. After each answer, either ask the next question or provide your triage result
5. Be concise and friendly

## Bug Report

**Title:** ${report.title}
**Reporter:** ${report.reporter_name ?? 'Unknown'}
**Description:**
${report.description}

${attachmentContext ? `## Attachments\n\n${attachmentContext}` : ''}

## Start

Analyze the bug report. If you already have enough information, respond with your triage.
If you need more details, ask your first question with options if applicable.

## When done, respond with:
[TRIAGED]
- Severity: critical|high|medium|low
- Area: <affected module>
- Steps to reproduce: <numbered list>
- Root cause: <hypothesis>
- Suggested fix: <brief approach>

## If this is not a valid bug:
[REJECTED]
- Reason: <why>`
```

Remover a seção `[NEEDS_INFO]` — o agente agora faz perguntas como mensagens normais na conversa com opções. O status `needs_info` é setado quando o agent responde sem `[TRIAGED]` ou `[REJECTED]`.

### 7. Backend — Ajustar parsing do response do triage

No `bug-triage.ts`, após `runConversationTurn`:

```typescript
const response = (result.message as any)?.content ?? ''

if (response.includes('[TRIAGED]')) {
  // Parse severity and update status
  const severityMatch = response.match(/severity:\s*(critical|high|medium|low)/i)
  this.db.prepare("UPDATE bug_reports SET status = 'triaged', severity = ?, triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
    .run(severityMatch?.[1]?.toLowerCase() ?? null, response, reportId)
} else if (response.includes('[REJECTED]')) {
  this.db.prepare("UPDATE bug_reports SET status = 'rejected', triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
    .run(response, reportId)
} else {
  // Agent asked a question — set needs_info and wait for user response
  this.db.prepare("UPDATE bug_reports SET status = 'needs_info', updated_at = datetime('now') WHERE id = ?")
    .run(reportId)
}
```

### 8. Backend — Respond endpoint deve trigger next turn

No `POST /api/bug-reports/:id/respond`, após o user responde, deve automaticamente trigger o next turn do agent:

```typescript
// After storing user's response message:
const { runConversationTurn } = await import('../services/conversation-runner.js')
const result = await runConversationTurn(db, conversationId, providerRegistry)

// Process agent's response (same logic as startTriage)
const agentResponse = (result.message as any)?.content ?? ''
if (agentResponse.includes('[TRIAGED]')) { ... }
else if (agentResponse.includes('[REJECTED]')) { ... }
else { /* still needs_info */ }
```

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **Opções no content**: parsear `[OPTIONS]...[/OPTIONS]` do conteúdo da mensagem, não criar nova coluna
4. **Strip options do display**: o MessageBubble mostra o texto da pergunta SEM o bloco [OPTIONS], as opções aparecem como botões abaixo
5. **Uma pergunta por vez**: o triage agent pergunta uma coisa, espera resposta, depois pergunta outra
6. **Botões desaparecem**: opções só aparecem na última mensagem do agent, somem quando o user responde
7. **Resposta livre sempre disponível**: o input de texto continua funcional, o user pode ignorar as opções e digitar
8. **Conversa continua**: após responder (clique ou texto), o agent automaticamente responde (next turn)

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Criar bug report → Start Triage
2. Agent analisa e faz primeira pergunta com [OPTIONS]
3. Opções aparecem como botões clicáveis abaixo da mensagem
4. Clicar numa opção → envia como mensagem → agent responde com próxima pergunta
5. Digitar resposta livre → funciona normalmente
6. Após todas as perguntas → agent responde com [TRIAGED] → status muda para triaged
7. Opções só aparecem na última mensagem, não nas anteriores
