'use client'

import { FileCode, Github, Heart, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { motion } from 'framer-motion'

export function Footer() {
  const { goBrowse, goHome } = useAppStore()
  return (
    <footer className="mt-auto border-t border-border/40 glass">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-brand to-brand-2 text-brand-foreground">
              <FileCode className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium text-foreground">PasteShare</span>
            <span className="hidden sm:inline">· Share code & files, beautifully</span>
          </motion.div>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <button
              onClick={goHome}
              className="transition-colors hover:text-foreground"
            >
              New paste
            </button>
            <button
              onClick={goBrowse}
              className="transition-colors hover:text-foreground"
            >
              Browse
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" /> Source
            </a>
            <span className="flex items-center gap-1">
              Built with <Heart className="h-3 w-3 fill-brand text-brand" /> on Next.js
              <Sparkles className="h-3 w-3 text-brand-2" />
            </span>
          </nav>
        </div>
      </div>
    </footer>
  )
}
