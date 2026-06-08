import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Check } from 'lucide-react'

interface Props {
  onComplete: () => void
}

export function SetupPage({ onComplete }: Props) {
  const setupComplete = useAuthStore((s) => s.setupComplete)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Admin
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')

  // Step 2: Provider
  const [providerType, setProviderType] = useState('claude-api')
  const [providerName, setProviderName] = useState('')
  const [providerKey, setProviderKey] = useState('')

  // Step 3: GitHub
  const [githubToken, setGithubToken] = useState('')

  function validateStep1() {
    if (!adminName || !adminEmail || !adminPassword) return 'All fields are required'
    if (adminPassword.length < 8) return 'Password must be at least 8 characters'
    if (adminPassword !== adminConfirm) return 'Passwords do not match'
    return null
  }

  function next() {
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    setError('')
    setStep(step + 1)
  }

  async function handleComplete() {
    setError('')
    setLoading(true)
    try {
      const data: any = {
        admin: { name: adminName, email: adminEmail, password: adminPassword },
      }
      if (providerName && providerKey) {
        data.providers = [{ name: providerName, type: providerType, configJson: { apiKey: providerKey } }]
      }
      if (githubToken) data.githubToken = githubToken
      await setupComplete(data)
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Admin Account', 'LLM Provider', 'GitHub Token']

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[var(--color-bg-dark)]">
      <div className="w-full max-w-[480px] px-4">
        {/* Brand */}
        <div className="mb-10 text-center">
          <span className="text-[22px] font-bold tracking-tight text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Gaud<span className="font-normal text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">.ai</span>
          </span>
        </div>

        {/* Steps indicator */}
        <div className="mb-8 flex items-center justify-center gap-0">
          {steps.map((label, i) => {
            const stepNum = i + 1
            const isCurrent = stepNum === step
            const isDone = stepNum < step
            return (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <div className={`h-px w-12 transition-colors ${isDone ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)] dark:bg-[var(--color-border-dark)]'}`} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors',
                    isCurrent
                      ? 'bg-[var(--color-primary)] text-white'
                      : isDone
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'border border-[var(--color-border)] text-[var(--color-muted)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-muted-dark)]',
                  ].join(' ')}>
                    {isDone ? <Check size={14} strokeWidth={2.5} /> : stepNum}
                  </div>
                  <span className={[
                    'text-[11px] whitespace-nowrap',
                    isCurrent
                      ? 'font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]'
                      : 'text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]',
                  ].join(' ')}>
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3.5">
              <Input label="Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required autoFocus placeholder="Your full name" />
              <Input label="Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="admin@company.com" />
              <Input label="Password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required helper="At least 8 characters" />
              <Input label="Confirm Password" type="password" value={adminConfirm} onChange={(e) => setAdminConfirm(e.target.value)} required />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Provider Type</label>
                <select
                  value={providerType}
                  onChange={(e) => setProviderType(e.target.value)}
                  className="h-9 w-full appearance-none rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
                >
                  <option value="claude-api">Claude (Anthropic)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>
              <Input label="Provider Name" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. My Claude API" />
              <Input label="API Key" type="password" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} placeholder="sk-..." />
              <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                Optional. You can configure providers later in Settings.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3.5">
              <Input label="GitHub Token (PAT)" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="github_pat_..." />
              <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                Used for cloning repositories and creating pull requests. You can skip this and set the <code className="font-mono text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">GITHUB_TOKEN</code> environment variable later.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4 dark:border-[var(--color-border-dark)]">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={() => { setError(''); setStep(step - 1) }}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step >= 2 && step <= 3 && (
                step < 3 ? (
                  <Button variant="secondary" onClick={() => { setError(''); setStep(step + 1) }}>
                    Skip
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleComplete} disabled={loading}>
                    Skip
                  </Button>
                )
              )}
              {step < 3 ? (
                <Button onClick={next}>Next</Button>
              ) : (
                <Button onClick={handleComplete} loading={loading}>
                  Complete Setup
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-center text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          Step {step} of {steps.length}
        </p>
      </div>
    </div>
  )
}
