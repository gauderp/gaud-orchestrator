# Prompt: Indicador de "agent trabalhando" + fila de mensagens do usuário

Duas mudanças de UX na conversa:
1. Feedback visual quando o agent está processando (typing indicator)
2. Mensagens do user enfileiradas quando agent está ocupado

Leia os arquivos referenciados antes de editar.

## Contexto

- `ConversationView.tsx` — renderiza mensagens, input, status
- `MessageBubble.tsx` — renderiza cada mensagem individual
- `useConversationStore` (Zustand) — gerencia estado da conversa, sendMessage, WebSocket handlers
- `App.tsx` — recebe WebSocket events (`conversation:message`, `conversation:status`)
- `bug-triage.ts` — chama provider diretamente e faz broadcast via WebSocket
- `conversation-runner.ts` — roda turns de conversa com agents

## Parte 1: Typing Indicator

### 1a. Backend — Broadcast evento "agent:typing"

Quando o agent começa a processar, o backend deve emitir um evento WebSocket para que o frontend mostre o indicador.

**`packages/api/src/services/bug-triage.ts`:**

Antes de chamar `provider.spawn()`, broadcast:
```typescript
broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: true })
```

Após receber a resposta e salvar a mensagem:
```typescript
broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: false })
```

**`packages/api/src/services/conversation-runner.ts`:**

Mesmo padrão — antes do `provider.spawn()`:
```typescript
broadcast('conversation:typing', { conversationId, agentId: nextAgent.agentId, typing: true })
```

Após salvar a mensagem do agent:
```typescript
broadcast('conversation:typing', { conversationId, agentId: nextAgent.agentId, typing: false })
```

### 1b. Frontend — Handler do WebSocket

**`packages/web/src/App.tsx`:**

Adicionar handler para o evento `conversation:typing`:

```typescript
case 'conversation:typing':
  useConversationStore.getState().onTyping(
    msg.payload.conversationId,
    msg.payload.agentId,
    msg.payload.typing
  )
  break
```

### 1c. Frontend — Store

**`packages/web/src/store/conversations.ts`:**

Adicionar state e handler para typing:

```typescript
interface ConversationState {
  // ... existing fields
  typingAgents: Record<string, string[]>  // conversationId → list of typing agentIds

  onTyping: (conversationId: string, agentId: string, typing: boolean) => void
}

// In the store:
typingAgents: {},

onTyping: (conversationId, agentId, typing) => {
  set((s) => {
    const current = s.typingAgents[conversationId] ?? []
    const updated = typing
      ? [...new Set([...current, agentId])]
      : current.filter(id => id !== agentId)
    return { typingAgents: { ...s.typingAgents, [conversationId]: updated } }
  })
},
```

### 1d. Frontend — Typing Indicator Component

**Novo: `packages/web/src/components/conversation/TypingIndicator.tsx`**

```tsx
interface TypingIndicatorProps {
  agentNames: string[]
  agentColors: Record<string, string>
}

export function TypingIndicator({ agentNames, agentColors }: TypingIndicatorProps) {
  if (agentNames.length === 0) return null

  const name = agentNames[0]!
  const color = agentColors[agentNames[0]!] ?? 'var(--color-accent)'

  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Avatar */}
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5"
        style={{ backgroundColor: color }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Typing animation */}
      <div className="flex items-center gap-1 pt-1.5">
        <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {name}
        </span>
        <div className="flex items-center gap-0.5 ml-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)] dark:bg-[var(--color-muted-dark)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
```

### 1e. Frontend — Integrar no ConversationView

**`packages/web/src/components/conversation/ConversationView.tsx`:**

Importar e renderizar o TypingIndicator após a lista de mensagens, antes do `messagesEndRef`:

```tsx
import { TypingIndicator } from './TypingIndicator'
import { useConversationStore } from '@/store/conversations'

// Dentro do componente:
const typingAgents = useConversationStore((s) => s.typingAgents[conversation.id] ?? [])
const typingNames = typingAgents.map(id => agentNames[id] ?? 'Agent')

// No JSX, após o map de mensagens e antes do messagesEndRef:
<TypingIndicator
  agentNames={typingNames}
  agentColors={agentColors}
/>
<div ref={messagesEndRef} />
```

O auto-scroll já funciona — quando o TypingIndicator aparece, o `messagesEndRef` é scrollado para view.

---

## Parte 2: Fila de Mensagens do Usuário

Quando o agent está processando (typing), as mensagens do user devem ser enfileiradas e enviadas automaticamente quando o agent terminar.

### 2a. Frontend — Store com fila

**`packages/web/src/store/conversations.ts`:**

Adicionar state de fila:

```typescript
interface ConversationState {
  // ... existing fields
  messageQueue: Record<string, string[]>  // conversationId → queued messages
  processing: Record<string, boolean>     // conversationId → is agent processing
}

// Initialize:
messageQueue: {},
processing: {},
```

Modificar `sendMessage` para enfileirar se agent está processando:

```typescript
sendMessage: async (id, content) => {
  const { processing, messageQueue } = get()

  if (processing[id]) {
    // Agent is working — queue the message
    set((s) => ({
      messageQueue: {
        ...s.messageQueue,
        [id]: [...(s.messageQueue[id] ?? []), content],
      },
    }))
    return
  }

  // Send immediately
  const msg = await api.conversations.sendMessage(id, content)
  set((s) => {
    if (!s.activeConversation || s.activeConversation.id !== id) return s
    return {
      activeConversation: {
        ...s.activeConversation,
        messages: [...s.activeConversation.messages, msg],
        status: 'active',
      },
    }
  })
  if (get().autoRun) {
    setTimeout(() => get().triggerNextTurn(id), 500)
  }
},
```

Modificar `onTyping` para processar a fila quando agent para de digitar:

```typescript
onTyping: (conversationId, agentId, typing) => {
  set((s) => {
    const current = s.typingAgents[conversationId] ?? []
    const updated = typing
      ? [...new Set([...current, agentId])]
      : current.filter(id => id !== agentId)
    return {
      typingAgents: { ...s.typingAgents, [conversationId]: updated },
      processing: { ...s.processing, [conversationId]: updated.length > 0 },
    }
  })

  // When agent stops typing, send queued messages
  if (!typing) {
    const { messageQueue } = get()
    const queue = messageQueue[conversationId] ?? []
    if (queue.length > 0) {
      // Clear queue first
      set((s) => ({
        messageQueue: { ...s.messageQueue, [conversationId]: [] },
      }))
      // Send first queued message (rest will queue again if agent starts typing)
      get().sendMessage(conversationId, queue[0]!)
    }
  }
},
```

### 2b. Frontend — UI feedback for queued messages

No `ConversationView`, mostrar mensagens enfileiradas como "pending" abaixo do input:

```tsx
const messageQueue = useConversationStore((s) => s.messageQueue[conversation.id] ?? [])
const isProcessing = useConversationStore((s) => s.processing[conversation.id] ?? false)

// Abaixo do input bar, se há mensagens na fila:
{messageQueue.length > 0 && (
  <div className="border-t border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-4 py-2 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]">
    <p className="text-[11px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
      {messageQueue.length} message{messageQueue.length > 1 ? 's' : ''} queued — will send when agent finishes
    </p>
  </div>
)}
```

### 2c. Frontend — Disable input styling when processing

Quando o agent está processando, o input não deve estar desabilitado (user pode digitar e enfileirar), mas o botão de envio deve indicar "queue" ao invés de "send":

```tsx
// No botão de envio:
<Button onClick={handleSend} disabled={!input.trim()}>
  {isProcessing ? <Clock size={14} /> : <Send size={14} />}
</Button>
```

E um hint no placeholder:

```tsx
<textarea
  placeholder={isProcessing ? "Type a message (will be queued)..." : "Type a message..."}
  // ...
/>
```

---

## Parte 3: Bug Triage — typing events

### 3a. `packages/api/src/services/bug-triage.ts`

O triage já chama o provider diretamente. Adicionar broadcasts de typing:

```typescript
// Antes do provider.spawn():
broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: true })

// Após salvar a resposta do agent como mensagem (no finally ou após o broadcast de message):
broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: false })
```

Usar `try/finally` para garantir que `typing: false` é emitido mesmo se houver erro:

```typescript
broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: true })
try {
  // ... spawn, collect output, parse, save message ...
} finally {
  broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: false })
}
```

---

## Regras

1. **Tailwind CSS v4**: `[var(--color-prop)]`, NUNCA `[--color-prop]`
2. **Dark mode**: `dark:` variants
3. **animate-bounce**: Tailwind nativo, com `animationDelay` via style prop
4. **WebSocket**: usar o pattern existente de broadcast + handler no App.tsx + store handler
5. **Fila é client-side only**: mensagens queued ficam no Zustand store, não no servidor
6. **Uma mensagem por vez**: ao processar a fila, enviar a primeira, esperar o agent responder, depois enviar a próxima
7. **Typing indicator posicionado no scroll**: aparece onde a próxima mensagem vai aparecer, auto-scrolls com o flow

## Verificação

```bash
pnpm --filter @gaud/web typecheck    # 0 erros
pnpm --filter @gaud/api typecheck    # 0 erros
pnpm --filter @gaud/api test         # todos passando
```

Testar:
1. Start Triage → typing indicator aparece com nome do agent e dots animados
2. Enquanto agent processa → digitar mensagem → mostra "1 message queued"
3. Agent termina → mensagem queued é enviada automaticamente
4. Placeholder do input muda quando agent está processando
5. Botão muda de Send para Clock icon quando processando
6. Typing indicator some quando agent responde
7. Funciona tanto na conversa de triage (inline no bug) quanto em conversas normais (/conversations/:id)
