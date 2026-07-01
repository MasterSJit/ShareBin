'use client'

import { create } from 'zustand'
import type { SafeUser } from '@/lib/types'

export type View =
  | { name: 'home' }
  | { name: 'browse' }
  | { name: 'view'; idOrSlug: string }
  | { name: 'dashboard' }
  | { name: 'admin' }
  | { name: 'login' }
  | { name: 'register' }

type AppState = {
  view: View
  setView: (v: View) => void
  goHome: () => void
  goBrowse: () => void
  goView: (idOrSlug: string) => void
  goDashboard: () => void
  goAdmin: () => void
  goLogin: () => void
  goRegister: () => void

  user: SafeUser | null
  setUser: (u: SafeUser | null) => void
  loadingUser: boolean
  setLoadingUser: (b: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: { name: 'home' },
  setView: (v) => set({ view: v }),
  goHome: () => set({ view: { name: 'home' } }),
  goBrowse: () => set({ view: { name: 'browse' } }),
  goView: (idOrSlug) => set({ view: { name: 'view', idOrSlug } }),
  goDashboard: () => set({ view: { name: 'dashboard' } }),
  goAdmin: () => set({ view: { name: 'admin' } }),
  goLogin: () => set({ view: { name: 'login' } }),
  goRegister: () => set({ view: { name: 'register' } }),

  user: null,
  setUser: (u) => set({ user: u }),
  loadingUser: true,
  setLoadingUser: (b) => set({ loadingUser: b }),
}))
