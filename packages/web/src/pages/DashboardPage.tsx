import { useEffect, useState } from 'react'
import { api } from '@/api/client'

export function DashboardPage() {
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(console.error)
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">API Status</div>
          <div className="mt-2 text-2xl font-bold">
            {health ? (
              <span className="text-[--color-accent]">{health.status}</span>
            ) : (
              <span className="text-[--color-muted]">Loading...</span>
            )}
          </div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Active Agents</div>
          <div className="mt-2 text-2xl font-bold">0</div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Pending Specs</div>
          <div className="mt-2 text-2xl font-bold">0</div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          <div className="text-[--color-muted] dark:text-[--color-muted-dark]">Cost This Month</div>
          <div className="mt-2 text-2xl font-bold">$0.00</div>
        </div>
      </div>
    </div>
  )
}
