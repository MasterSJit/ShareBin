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

/* ------------------------------------------------------------------ */
/*  Hash-based routing                                                 */
/*  Format: #/           → home                                        */
/*          #/browse     → browse                                      */
/*          #/p/<slug>   → view paste                                  */
/*          #/dashboard  → dashboard                                   */
/*          #/admin      → admin                                       */
/*          #/login      → login                                       */
/*          #/register   → register                                    */
/* ------------------------------------------------------------------ */

export function viewToHash(v: View): string {
  switch (v.name) {
    case 'home':
      return '#/'
    case 'browse':
      return '#/browse'
    case 'view':
      return `#/p/${v.idOrSlug}`
    case 'dashboard':
      return '#/dashboard'
    case 'admin':
      return '#/admin'
    case 'login':
      return '#/login'
    case 'register':
      return '#/register'
  }
}

export function hashToView(hash: string): View {
  const h = hash.replace(/^#/, '').replace(/^\//, '')
  if (h === '' || h === 'home') return { name: 'home' }
  if (h === 'browse') return { name: 'browse' }
  if (h === 'dashboard') return { name: 'dashboard' }
  if (h === 'admin') return { name: 'admin' }
  if (h === 'login') return { name: 'login' }
  if (h === 'register') return { name: 'register' }
  if (h.startsWith('p/')) {
    const id = h.slice(2)
    if (id) return { name: 'view', idOrSlug: id }
  }
  return { name: 'home' }
}

type AppState = {
  view: View
  /** Navigate to a view AND push a new history entry (so Back button works). */
  setView: (v: View) => void
  /** Set view WITHOUT pushing history (used by popstate listener). */
  setViewFromHistory: (v: View) => void
  goHome: () => void
  goBrowse: () => void
  goView: (idOrSlug: string) => void
  goDashboard: () => void
  goAdmin: () => void
  goLogin: () => void
  goRegister: () => void

  /** Navigate back in browser history. */
  back: () => void
  /** Whether there's history to go back to. */
  canGoBack: boolean
  setCanGoBack: (b: boolean) => void

  user: SafeUser | null
  setUser: (u: SafeUser | null) => void
  loadingUser: boolean
  setLoadingUser: (b: boolean) => void
}

/** Recompute canGoBack from the live history API (history.length is imperfect
 *  but combined with our own navigation depth it's reliable enough for UX). */
function computeCanGoBack(): boolean {
  if (typeof window === 'undefined') return false
  // history.length >= 2 means there's at least one entry before the current.
  return window.history.length > 1
}

export const useAppStore = create<AppState>((set, get) => ({
  // Start with 'home' for SSR consistency; the popstate/hashchange installer
  // below syncs to the real hash on the client immediately after hydration.
  view: { name: 'home' },
  canGoBack: false,

  setView: (v) => {
    const hash = viewToHash(v)
    if (typeof window !== 'undefined' && window.location.hash !== hash) {
      window.history.pushState({ view: v }, '', hash)
    }
    set({ view: v, canGoBack: computeCanGoBack() })
  },

  setViewFromHistory: (v) => {
    set({ view: v, canGoBack: computeCanGoBack() })
  },

  goHome: () => get().setView({ name: 'home' }),
  goBrowse: () => get().setView({ name: 'browse' }),
  goView: (idOrSlug) => get().setView({ name: 'view', idOrSlug }),
  goDashboard: () => get().setView({ name: 'dashboard' }),
  goAdmin: () => get().setView({ name: 'admin' }),
  goLogin: () => get().setView({ name: 'login' }),
  goRegister: () => get().setView({ name: 'register' }),

  back: () => {
    if (typeof window !== 'undefined') window.history.back()
  },
  setCanGoBack: (b) => set({ canGoBack: b }),

  user: null,
  setUser: (u) => set({ user: u }),
  loadingUser: true,
  setLoadingUser: (b) => set({ loadingUser: b }),
}))

/* ------------------------------------------------------------------ */
/*  Global popstate listener — keeps store in sync with Back/Forward.  */
/*  Installed once on first import in the browser.                     */
/* ------------------------------------------------------------------ */
if (typeof window !== 'undefined') {
  // Avoid double-installing in HMR.
  if (!(window as unknown as { __psRouterInstalled?: boolean }).__psRouterInstalled) {
    ;(window as unknown as { __psRouterInstalled?: boolean }).__psRouterInstalled = true

    const syncFromHash = () => {
      const view = hashToView(window.location.hash)
      useAppStore.getState().setViewFromHistory(view)
    }

    window.addEventListener('popstate', syncFromHash)
    window.addEventListener('hashchange', syncFromHash)

    // Ensure the initial URL has a hash so Back/Forward semantics are clean.
    if (!window.location.hash) {
      window.history.replaceState({ view: { name: 'home' } }, '', '#/')
    }

    // Sync the store to the current URL hash on first load (handles deep-links
    // like opening /#/p/<slug> directly). Use a microtask so React hydrates
    // with the SSR 'home' view first, avoiding hydration mismatch.
    queueMicrotask(() => {
      syncFromHash()
      useAppStore.setState({ canGoBack: computeCanGoBack() })
    })
  }
}
