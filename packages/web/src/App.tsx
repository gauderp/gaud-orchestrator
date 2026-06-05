import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { AgentListPage } from '@/pages/AgentListPage'
import { AgentDetailPage } from '@/pages/AgentDetailPage'
import { SkillsListPage } from '@/pages/SkillsListPage'
import { SkillEditorPage } from '@/pages/SkillEditorPage'
import { ProviderConfigPage } from '@/pages/ProviderConfigPage'
import { useEffect } from 'react'
import { useAppStore } from '@/store/app'

export function AppRoutes() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

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
        {/* Placeholder routes — pages added in later phases */}
        <Route path="/boards" element={<Placeholder title="Boards" />} />
        <Route path="/specs" element={<Placeholder title="Specs" />} />
        <Route path="/executions" element={<Placeholder title="Executions" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
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
