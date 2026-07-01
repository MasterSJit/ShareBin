'use client'

import { useEffect } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { useAppStore } from '@/lib/store'
import { HomeView } from '@/components/views/home-view'
import { BrowseView } from '@/components/views/browse-view'
import { PasteView } from '@/components/views/paste-view'
import { DashboardView } from '@/components/views/dashboard-view'
import { AdminView } from '@/components/views/admin-view'
import { AuthView } from '@/components/views/auth-view'

export default function Home() {
  const { view, loadingUser } = useAppStore()

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {loadingUser && view.name === 'admin' ? (
          <div className="flex h-[60vh] items-center justify-center text-muted-foreground">Loading…</div>
        ) : (
          <ViewSwitcher />
        )}
      </main>
      <Footer />
    </div>
  )
}

function ViewSwitcher() {
  const { view } = useAppStore()
  switch (view.name) {
    case 'home':
      return <HomeView />
    case 'browse':
      return <BrowseView />
    case 'view':
      return <PasteView key={view.idOrSlug} idOrSlug={view.idOrSlug} />
    case 'dashboard':
      return <DashboardView />
    case 'admin':
      return <AdminView />
    case 'login':
      return <AuthView mode="login" />
    case 'register':
      return <AuthView mode="register" />
    default:
      return <HomeView />
  }
}
