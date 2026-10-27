'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import {
  Eye,
  FileText,
  FileType,
  Flag,
  Flame,
  Globe,
  Link as Link2,
  Lock,
} from 'lucide-react'
import type { SafePaste } from '@/lib/types'
import { formatBytes, formatRelativeTime, languageLabel } from '@/lib/ui-utils'
import { useAppStore } from '@/lib/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function VisibilityIcon({ v }: { v: string }) {
  if (v === 'public') return <Globe className="h-3 w-3" />
  if (v === 'unlisted') return <Link2 className="h-3 w-3" />
  return <Lock className="h-3 w-3" />
}

function visibilityLabel(v: string): string {
  if (v === 'public') return 'Public'
  if (v === 'unlisted') return 'Unlisted'
  return 'Private'
}

/** Compact relative time for card footers ("5m", "3h", "2d") — avoids wrapping. */
function shortAge(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(d / 365)}y`
}

/**
 * Clickable paste summary used in Browse, Home, Related and the Dashboard.
 * `actions` (e.g. Edit/Delete buttons) render in the footer; clicks on them
 * don't open the paste.
 */
export function PasteCard({ paste, actions }: { paste: SafePaste; actions?: React.ReactNode }) {
  const goView = useAppStore((s) => s.goView)
  const isFile = paste.contentType === 'file'
  const title =
    paste.title ||
    (isFile ? paste.originalFileName || `/${paste.slug}` : `/${paste.slug}`)
  const ownerName = paste.ownerName || 'guest'
  const isGuest = !paste.ownerName
  // Listings send a short `preview` for unlocked text pastes only.
  const preview =
    paste.contentType === 'text'
      ? paste.preview ??
        (paste.textContent
          ? paste.textContent.slice(0, 200) + (paste.textContent.length > 200 ? '…' : '')
          : null)
      : null

  function open() {
    goView(paste.slug)
  }

  // A div with role="link" (not a <button>) so the card can contain action buttons.
  return (
    <motion.div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label={`Open paste ${title}`}
      className="group block h-full w-full cursor-pointer rounded-xl text-left focus-brand"
    >
      <div className="surface relative flex h-full flex-col overflow-hidden rounded-xl p-4 transition-colors duration-300 group-hover:border-brand/40">
        {/* Left border accent — bg-border default, bg-brand grows 0→100% from top on hover */}
        <div
          className="absolute left-0 top-0 h-full w-0.5 bg-border"
          aria-hidden
        />
        <div
          className="absolute left-0 top-0 w-0.5 origin-top bg-brand transition-[height] duration-300 ease-out group-hover:h-full"
          style={{ height: 0 }}
          aria-hidden
        />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
              isFile
                ? 'bg-brand/15 text-brand'
                : 'bg-surface-3 text-muted-foreground',
            ].join(' ')}
          >
            {isFile ? (
              <FileType className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
            {title}
          </h3>
          {isFile ? (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {formatBytes(paste.fileSizeBytes)}
            </span>
          ) : (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {languageLabel(paste.language)}
            </span>
          )}
        </div>

        {/* Description */}
        {paste.description && (
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
            {paste.description}
          </p>
        )}

        {/* Locked content placeholder */}
        {!preview && paste.contentType === 'text' && (paste.hasPassword || paste.burnAfterRead) && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md bg-muted/30 p-2 font-mono text-[11px] text-muted-foreground/80">
            {paste.hasPassword ? <Lock className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
            {paste.hasPassword ? 'Password protected' : 'Burns after reading — open to reveal'}
          </p>
        )}

        {/* Text preview (text pastes only) */}
        {preview && (
          <pre className="mt-3 max-h-20 overflow-hidden rounded-md bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground/80">
            {preview}
          </pre>
        )}

        {/* Footer — single line: owner truncates, everything else keeps its width */}
        <div className="mt-auto flex items-center gap-2.5 whitespace-nowrap pt-4 font-mono text-[11px] text-muted-foreground">
          {/* Owner */}
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                isGuest
                  ? 'bg-muted-foreground/40'
                  : 'bg-gradient-to-br from-brand to-brand-2',
              ].join(' ')}
              aria-hidden
            />
            <span className="truncate">{ownerName}</span>
          </span>

          {/* Visibility — icon + tooltip only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 cursor-default">
                <VisibilityIcon v={paste.visibility} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {visibilityLabel(paste.visibility)}
            </TooltipContent>
          </Tooltip>

          {/* Views */}
          <span className="flex shrink-0 items-center gap-1" title={`${paste.viewCount} views`}>
            <Eye className="h-3 w-3" /> {paste.viewCount}
          </span>

          {/* Time */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 cursor-default">{shortAge(paste.createdAt)}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{formatRelativeTime(paste.createdAt)}</TooltipContent>
          </Tooltip>

          {/* Right-aligned badges — icon-only with tooltips */}
          <div className="flex shrink-0 items-center gap-2">
            {paste.burnAfterRead && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default text-brand-2">
                    <Flame className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Burn after read</TooltipContent>
              </Tooltip>
            )}
            {paste.hasPassword && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default">
                    <Lock className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Password protected</TooltipContent>
              </Tooltip>
            )}
            {paste.isFlagged && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default text-destructive">
                    <Flag className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Flagged</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {actions && (
          <div
            className="-mx-4 -mb-4 mt-3 flex items-center justify-end gap-1 border-t border-border/60 px-2 py-1.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  )
}
