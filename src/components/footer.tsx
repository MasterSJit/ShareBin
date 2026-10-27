'use client'

import { FileCode, Heart } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'
import { usePublicSettings } from '@/hooks/use-public-settings'

export function Footer() {
  const { goBrowse, goHome } = useAppStore()
  const { settings } = usePublicSettings()
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          {settings.logoUrl && settings.logoUrl !== '/logo.svg' ? (
            <img src={settings.logoUrl} alt={settings.siteName} className="h-5 w-5 rounded object-contain" />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded bg-brand text-brand-foreground">
              <FileCode className="h-3 w-3" />
            </div>
          )}
          <span className="font-medium text-foreground">{settings.siteName}</span>
          <span className="hidden sm:inline">· {settings.tagline}</span>
        </div>
        <nav className="flex items-center gap-4">
          <button onClick={goHome} className="transition-colors hover:text-foreground">
            New
          </button>
          <button onClick={goBrowse} className="transition-colors hover:text-foreground">
            Browse
          </button>
          {settings.socialLinks && typeof settings.socialLinks === 'object' && Object.keys(settings.socialLinks).length > 0 && (
            Object.entries(settings.socialLinks).map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground capitalize">
                {name}
              </a>
            ))
          )}
          <span className="flex items-center gap-1 text-xs">
            built with <Heart className="h-3 w-3 fill-brand text-brand" />
          </span>
        </nav>
      </div>
    </footer>
  )
}
