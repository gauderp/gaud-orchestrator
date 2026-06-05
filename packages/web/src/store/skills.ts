import { create } from 'zustand'
import type { Skill } from '@gaud/shared'
import { api } from '@/api/client'

interface SkillState {
  skills: Skill[]
  loading: boolean
  fetchSkills: () => Promise<void>
  createSkill: (data: { name: string; description?: string; content: string }) => Promise<Skill>
  updateSkill: (id: string, data: { name: string; description?: string; content: string }) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  loading: false,

  fetchSkills: async () => {
    set({ loading: true })
    const skills = await api.skills.list()
    set({ skills, loading: false })
  },

  createSkill: async (data) => {
    const skill = await api.skills.create(data)
    set((s) => ({ skills: [...s.skills, skill] }))
    return skill
  },

  updateSkill: async (id, data) => {
    const skill = await api.skills.update(id, data)
    set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? skill : sk)) }))
  },

  deleteSkill: async (id) => {
    await api.skills.delete(id)
    set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }))
  },
}))
