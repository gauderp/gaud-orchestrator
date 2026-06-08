import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[var(--color-bg-dark)]">
      <div className="w-full max-w-[380px] px-4">
        {/* Brand */}
        <div className="mb-10 text-center">
          <span className="text-[22px] font-bold tracking-tight text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Gaud<span className="font-normal text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">.ai</span>
          </span>
        </div>

        {/* Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          <h2 className="mb-1 text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Sign in</h2>
          <p className="mb-5 text-[13px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Enter your credentials to continue.</p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@company.com" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" loading={loading} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
