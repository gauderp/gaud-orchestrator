import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { AgentListPage } from '@/pages/AgentListPage'
import { AgentDetailPage } from '@/pages/AgentDetailPage'
import { SkillsListPage } from '@/pages/SkillsListPage'
import { SkillEditorPage } from '@/pages/SkillEditorPage'
import { ProviderConfigPage } from '@/pages/ProviderConfigPage'
import { BoardListPage } from '@/pages/BoardListPage'
import { BoardViewPage } from '@/pages/BoardViewPage'
import { GanttViewPage } from '@/pages/GanttViewPage'
import { BoardSettingsPage } from '@/pages/BoardSettingsPage'
import { CardDetailPage } from '@/pages/CardDetailPage'
import { ConversationPage } from '@/pages/ConversationPage'
import { AgentMemoryPage } from '@/pages/AgentMemoryPage'
import { SpecStudioPage } from '@/pages/SpecStudioPage'
import { SpecReviewPage } from '@/pages/SpecReviewPage'
import { SpecDetailPage } from '@/pages/SpecDetailPage'
import { ExecutionListPage } from '@/pages/ExecutionListPage'
import { ExecutionDetailPage } from '@/pages/ExecutionDetailPage'
import { ToastContainer } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useEffect } from 'react'
import { useAppStore } from '@/store/app'
import { useBoardStore } from '@/store/boards'
import { useConversationStore } from '@/store/conversations'
import { useSpecStore } from '@/store/specs'
import { useExecutionStore } from '@/store/executions'

export function AppRoutes() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const wsPort = location.port === '5173' ? '3001' : location.port
    const ws = new WebSocket(`ws://${location.hostname}:${wsPort}/ws`)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const state = useBoardStore.getState()
        switch (msg.type) {
          case 'card:moved': state.onCardMoved(msg.payload); break
          case 'card:created': state.onCardCreated(msg.payload); break
          case 'card:updated': state.onCardUpdated(msg.payload); break
          case 'card:deleted': state.onCardDeleted(msg.payload.id); break
          case 'conversation:message':
            useConversationStore.getState().onMessage(msg.payload.conversationId, msg.payload.message)
            break
          case 'conversation:status':
            useConversationStore.getState().onStatusChange(msg.payload.conversationId, msg.payload.status)
            break
          case 'conversation:question': {
            const { conversationId, question } = msg.payload as { conversationId: string; question: string }
            console.log(`[WS] Agent question in ${conversationId}: ${question}`)
            break
          }
          case 'conversation:artifact': {
            const { conversationId } = msg.payload as { conversationId: string; artifact: string }
            console.log(`[WS] Artifact produced in ${conversationId}`)
            break
          }
          case 'spec:updated':
            useSpecStore.getState().onSpecUpdated(msg.payload)
            break
          case 'execution:updated':
            useExecutionStore.getState().onExecutionUpdated(msg.payload)
            break
          case 'execution:task:log':
            // Real-time log append — refreshed when execution detail is viewed
            break
          case 'memory:stored':
          case 'memory:learning':
            // Memory events — UI refresh handled by store when page is active
            console.log(`[WS] Memory event: ${msg.type}`, msg.payload)
            break
        }
      } catch {
        // ignore malformed messages
      }
    }
    return () => ws.close()
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentListPage />} />
        <Route path="/agents/:id" element={<AgentDetailPage />} />
        <Route path="/skills" element={<SkillsListPage />} />
        <Route path="/skills/new" element={<SkillEditorPage />} />
        <Route path="/skills/:id" element={<SkillEditorPage />} />
        <Route path="/settings/providers" element={<ProviderConfigPage />} />
        <Route path="/boards" element={<BoardListPage />} />
        <Route path="/boards/:id" element={<BoardViewPage />} />
        <Route path="/boards/:id/gantt" element={<GanttViewPage />} />
        <Route path="/boards/:id/settings" element={<BoardSettingsPage />} />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/conversations/:id" element={<ConversationPage />} />
        <Route path="/agents/:id/memory" element={<AgentMemoryPage />} />
        <Route path="/specs/studio" element={<SpecStudioPage />} />
        <Route path="/specs" element={<SpecReviewPage />} />
        <Route path="/specs/:id" element={<SpecDetailPage />} />
        <Route path="/executions" element={<ExecutionListPage />} />
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
      <ToastContainer />
    </BrowserRouter>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Coming in next phase.</p>
    </div>
  )
}
