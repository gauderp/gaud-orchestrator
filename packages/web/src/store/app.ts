import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'gaud-app' }
  )
)
