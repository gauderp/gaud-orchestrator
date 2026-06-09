import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@gaud/shared'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<boolean>
  fetchMe: () => Promise<void>
  setupComplete: (data: any) => Promise<void>
}

const API = '/api'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Login failed')
        }
        const data = await res.json()
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const res = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
          if (!res.ok) { get().logout(); return false }
          const data = await res.json()
          set({ accessToken: data.accessToken })
          return true
        } catch { get().logout(); return false }
      },

      fetchMe: async () => {
        let { accessToken } = get()
        if (!accessToken) return

        let res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } })

        // Token expired — try refresh
        if (res.status === 401) {
          const refreshed = await get().refresh()
          if (!refreshed) return
          accessToken = get().accessToken
          if (!accessToken) return
          res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
        }

        if (!res.ok) { get().logout(); return }
        const user = await res.json()
        set({ user, isAuthenticated: true })
      },

      setupComplete: async (data) => {
        const res = await fetch(`${API}/setup/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Setup failed')
        }
        const result = await res.json()
        set({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, isAuthenticated: true })
      },
    }),
    { name: 'gaud-auth' }
  )
)
