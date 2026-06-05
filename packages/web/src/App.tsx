import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
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
        {/* Placeholder routes — pages added in later phases */}
        <Route path="/agents" element={<Placeholder title="Agents" />} />
        <Route path="/skills" element={<Placeholder title="Skills" />} />
        <Route path="/boards" element={<Placeholder title="Boards" />} />
        <Route path="/specs" element={<Placeholder title="Specs" />} />
        <Route path="/executions" element={<Placeholder title="Executions" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="/settings/providers" element={<Placeholder title="Providers" />} />
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
