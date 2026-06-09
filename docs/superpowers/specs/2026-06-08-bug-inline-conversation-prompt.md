# Prompt: Conversa de triage inline na página do bug report

Hoje a conversa de triagem abre em outra página (`/conversations/:id`). Deve acontecer inline na própria `BugReportDetailPage`.

Leia os arquivos referenciados antes de editar.

## Contexto

- `BugReportDetailPage.tsx` — página de detalhe do bug com status, description, attachments, triage summary, actions
- `ConversationView.tsx` — componente que renderiza conversa (mensagens, input, status)
- O bug report tem `conversationId` após o triage ser iniciado
- A conversa é do tipo `research` com o triage-agent como participante
- Mensagens são recebidas via WebSocket (`conversation:message`, `conversation:status`)

## Mudanças

### 1. `packages/web/src/pages/BugReportDetailPage.tsx`

**IMPORTANTE: esta página ainda usa inline styles. Migrar para Tailwind v4 com `[var(--color-*)]` syntax e componentes UI (`Button`, `Input`, `Badge`, `Textarea`, `Modal`) ao fazer as mudanças.**

**1a) Importar e renderizar ConversationView inline:**

```tsx
import { ConversationView } from '@/components/conversation/ConversationView'
import { useConversationStore } from '@/store/conversations'
```

Quando `report.conversationId` existe, buscar a conversa e renderizar o `ConversationView` diretamente na página, substituindo o botão "View Triage Conversation":

```tsx
// Substituir o bloco:
{report.conversationId && (
  <button onClick={() => navigate(`/conversations/${report.conversationId}`)}>
    View Triage Conversation
  </button>
)}

// Por:
{report.conversationId && (
  <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] overflow-hidden">
    <div className="border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-4 py-2 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]">
      <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
        Triage Conversation
      </h3>
    </div>
    <div className="h-[400px]">
      <ConversationView conversation={activeConversation} />
    </div>
  </div>
)}
```

**1b) Carregar conversa quando report tem conversationId:**

```tsx
const { activeConversation, fetchConversation } = useConversationStore()

useEffect(() => {
  if (report?.conversationId) {
    fetchConversation(report.conversationId)
  }
}, [report?.conversationId, fetchConversation])
```

**1c) Remover o botão "View Triage Conversation"** — a conversa já está inline.

**1d) O textarea de "respond" para needs_info pode ser removido** — o ConversationView já tem input para enviar mensagens. Ou manter ambos se preferir UX dedicada para o reporter.

**1e) Após clicar "Start Triage"**, a conversa deve aparecer automaticamente quando o `conversationId` é setado no bug report (o polling existente com `setTimeout(loadData, 2000/5000/10000)` já cuida disso).

### 2. Verificar `ConversationView` aceita height constraints

O `ConversationView` em `packages/web/src/components/conversation/ConversationView.tsx` precisa funcionar dentro de um container com height fixo (`h-[400px]`). Verificar se usa `flex-1 overflow-y-auto` internamente para scroll.

Se o ConversationView assumir `h-full` ou `h-screen`, ajustar para funcionar em container bounded.

### 3. Migrar toda a BugReportDetailPage para Tailwind + design tokens

Converter todos os `style={{...}}` para classes Tailwind:

Mapeamento de referência:
- `padding: '24px'` → `p-6`
- `maxWidth: '800px', margin: '0 auto'` → `mx-auto max-w-3xl`
- `fontSize: '20px', fontWeight: 600` → `text-xl font-semibold`
- `fontSize: '13px'` → `text-[13px]`
- `fontSize: '12px'` → `text-xs`
- `borderRadius: '8px'` → `rounded-[var(--radius-lg)]`
- `borderRadius: '6px'` → `rounded-[var(--radius-md)]`
- `border: '1px solid #e5e7eb'` → `border border-[var(--color-border)] dark:border-[var(--color-border-dark)]`
- `background: '#fff'` → `bg-white dark:bg-[var(--color-surface-dark)]`
- `color: '#6b7280'` → `text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]`
- `color: '#dc2626'` → `text-[var(--color-destructive)]`
- `color: '#2563eb'` → `text-[var(--color-primary)]`
- `color: '#166534'` / `background: '#dcfce7'` → `text-[var(--color-accent)]` / `bg-[var(--color-accent)]/10`
- `cursor: 'pointer'` → `cursor-pointer`

Usar componentes:
- Botões → `<Button>`, `<Button variant="destructive">`, `<Button variant="secondary">`
- Status badges → `<Badge variant={...}>`
- Textarea de respond → `<Textarea>`
- Select de agent/board/column → styled select com classes Tailwind (como no SetupPage)

### 4. Status badges — usar Badge component

Substituir os spans com inline style por `<Badge>`:

```typescript
const statusBadgeVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error' | 'info'> = {
  new: 'info',
  triaging: 'warning',
  needs_info: 'warning',
  triaged: 'success',
  rejected: 'error',
}

const severityBadgeVariant: Record<string, 'error' | 'warning' | 'neutral' | 'info'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
}
```

```tsx
<Badge variant={statusBadgeVariant[report.status] ?? 'neutral'}>
  {statusConfig[report.status]?.label ?? report.status}
</Badge>
{report.severity && (
  <Badge variant={severityBadgeVariant[report.severity] ?? 'neutral'}>
    {report.severity}
  </Badge>
)}
```

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **Componentes UI**: usar `Button`, `Badge`, `Textarea`, `Modal` de `@/components/ui/`
4. **ConversationView**: reutilizar o componente existente, não recriar
5. **WebSocket**: mensagens da conversa de triage já são recebidas via WS — o ConversationView já lida com isso via `useConversationStore`
6. **Height**: conversa inline com `h-[400px]` e scroll interno, não ocupar a página inteira
7. **Polling**: manter o polling existente após Start Triage para atualizar o status do bug

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
```

Testar:
1. Abrir bug report → clicar Start Triage
2. Conversa aparece inline na mesma página após polling
3. Mensagens do agent aparecem em tempo real via WebSocket
4. Se needs_info → user pode responder direto na conversa inline
5. Status badges usando design tokens
6. Dark mode funciona
7. Toda a página sem inline styles
