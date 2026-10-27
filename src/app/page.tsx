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
import { PageTransition } from '@/components/motion-helpers'
import { AnimatePresence } from 'framer-motion'
import { usePublicSettings } from '@/hooks/use-public-settings'

export default function Home() {
  const { view, loadingUser } = useAppStore()
  const { settings } = usePublicSettings()

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view])

  // Update document title + favicon dynamically from settings
  useEffect(() => {
    document.title = settings.siteName + ' — ' + settings.tagline
    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
    if (favicon && settings.faviconUrl) {
      favicon.href = settings.faviconUrl
    }
  }, [settings.siteName, settings.tagline, settings.faviconUrl])

  const viewKey =
    view.name === 'view' ? `view:${view.idOrSlug}` : view.name

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="relative flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={viewKey} k={viewKey}>
            {loadingUser && view.name === 'admin' ? (
              <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
                Loading…
              </div>
            ) : (
              <ViewSwitcher />
            )}
          </PageTransition>
        </AnimatePresence>
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
    case 'reset':
      return <AuthView mode="reset" resetToken={view.token} />
    default:
      return <HomeView />
  }
}
