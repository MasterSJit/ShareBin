'use client'

import { FileCode, Heart } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'

export function Footer() {
  const { goBrowse, goHome } = useAppStore()
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-brand text-brand-foreground">
            <FileCode className="h-3 w-3" />
          </div>
          <span className="font-medium text-foreground">PasteShare</span>
          <span className="hidden sm:inline">· terminal-grade sharing</span>
        </div>
        <nav className="flex items-center gap-4">
          <button onClick={goHome} className="transition-colors hover:text-foreground">
            New
          </button>
          <button onClick={goBrowse} className="transition-colors hover:text-foreground">
            Browse
          </button>
          <span className="flex items-center gap-1 text-xs">
            built with <Heart className="h-3 w-3 fill-brand text-brand" />
          </span>
        </nav>
      </div>
    </footer>
  )
}
