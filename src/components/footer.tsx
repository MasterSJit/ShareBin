'use client'

import { FileCode, Github, Heart } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function Footer() {
  const { goBrowse, goHome } = useAppStore()
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <FileCode className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium text-foreground">PasteShare</span>
            <span>· Share code & files with syntax-highlighted links</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <button onClick={goHome} className="hover:text-foreground transition">
              New paste
            </button>
            <button onClick={goBrowse} className="hover:text-foreground transition">
              Browse
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition"
            >
              <Github className="h-3.5 w-3.5" /> Source
            </a>
            <span className="flex items-center gap-1">
              Built with <Heart className="h-3 w-3 fill-destructive text-destructive" /> on Next.js
            </span>
          </nav>
        </div>
      </div>
    </footer>
  )
}
