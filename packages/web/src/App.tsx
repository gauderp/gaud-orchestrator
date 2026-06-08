import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { RepositoryListPage } from '@/pages/RepositoryListPage'
import { OrgChartPage } from '@/pages/OrgChartPage'
import { BugReportPage } from '@/pages/BugReportPage'
import { BugReportDetailPage } from '@/pages/BugReportDetailPage'
import { BackupPage } from '@/pages/BackupPage'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { UsersPage } from '@/pages/UsersPage'
import { ToastContainer } from '@/components/ui/Toast'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app'
import { useAuthStore } from '@/store/auth'
import { useBoardStore } from '@/store/boards'
import { useConversationStore } from '@/store/conversations'
import { useSpecStore } from '@/store/specs'
import { useExecutionStore } from '@/store/executions'
import { useToastStore } from '@/store/toast'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRoutes() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const wsPort = location.port === '5173' ? '3001' : location.port
    const ws = new WebSocket(`ws://${location.hostname}:${wsPort}/ws?token=${token}`)
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
          case 'conversation:question':
            useToastStore.getState().addToast('warning', 'An agent needs your input', 5000)
            break
          case 'conversation:artifact':
            useToastStore.getState().addToast('success', 'Agent produced an artifact', 4000)
            break
          case 'spec:updated':
            useSpecStore.getState().onSpecUpdated(msg.payload)
            break
          case 'execution:updated':
            useExecutionStore.getState().onExecutionUpdated(msg.payload)
            break
          case 'execution:task:log':
            // Real-time log append — refreshed when execution detail is viewed
            break
          case 'bug_report:created':
          case 'bug_report:triaging':
          case 'bug_report:triaged':
          case 'bug_report:needs_info':
          case 'bug_report:rejected':
            console.log(`[WS] Bug report event: ${msg.type}`, msg.payload)
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
      <Route element={<AuthGuard><Layout /></AuthGuard>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentListPage />} />
        <Route path="/agents/org" element={<OrgChartPage />} />
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
        <Route path="/repositories" element={<RepositoryListPage />} />
        <Route path="/bugs" element={<BugReportPage />} />
        <Route path="/bugs/:id" element={<BugReportDetailPage />} />
        <Route path="/settings/backup" element={<BackupPage />} />
        <Route path="/settings/users" element={<UsersPage />} />
        <Route path="/settings" element={<Navigate to="/settings/providers" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null)
  const { isAuthenticated, fetchMe } = useAuthStore()

  useEffect(() => {
    fetch('/api/setup/status').then(r => r.json()).then(d => setSetupCompleted(d.completed)).catch(() => setSetupCompleted(true))
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchMe()
  }, [])

  if (setupCompleted === null) return null // loading

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public routes — no layout */}
          <Route path="/setup" element={setupCompleted ? <Navigate to="/" replace /> : <SetupPage onComplete={() => setSetupCompleted(true)} />} />
          <Route path="/login" element={!setupCompleted ? <Navigate to="/setup" replace /> : isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

          {/* Protected routes — with layout */}
          <Route path="/*" element={
            !setupCompleted ? <Navigate to="/setup" replace /> :
            !isAuthenticated ? <Navigate to="/login" replace /> :
            <AppRoutes />
          } />
        </Routes>
      </ErrorBoundary>
      <CommandPalette />
      <ToastContainer />
    </BrowserRouter>
  )
}
