'use client'

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
import { formatBytes, formatRelativeTime } from '@/lib/ui-utils'
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

export function PasteCard({ paste }: { paste: SafePaste }) {
  const goView = useAppStore((s) => s.goView)
  const isFile = paste.contentType === 'file'
  const title =
    paste.title ||
    (isFile ? paste.originalFileName || `/${paste.slug}` : `/${paste.slug}`)
  const ownerName = paste.ownerName || 'guest'
  const isGuest = !paste.ownerName
  const preview =
    paste.contentType === 'text' && paste.textContent
      ? paste.textContent.slice(0, 200) +
        (paste.textContent.length > 200 ? '…' : '')
      : null

  function open() {
    goView(paste.slug)
  }

  return (
    <motion.button
      type="button"
      onClick={open}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label={`Open paste ${title}`}
      className="group block w-full cursor-pointer rounded-xl text-left focus-brand"
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
              {paste.language}
            </span>
          )}
        </div>

        {/* Description */}
        {paste.description && (
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
            {paste.description}
          </p>
        )}

        {/* Text preview (text pastes only) */}
        {preview && (
          <pre className="mt-3 max-h-20 overflow-hidden rounded-md bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground/80">
            {preview}
          </pre>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center gap-3 pt-4 font-mono text-[11px] text-muted-foreground">
          {/* Owner */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                isGuest
                  ? 'bg-muted-foreground/40'
                  : 'bg-gradient-to-br from-brand to-brand-2',
              ].join(' ')}
              aria-hidden
            />
            <span className="max-w-[80px] truncate">{ownerName}</span>
          </span>

          {/* Visibility — icon + tooltip only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default">
                <VisibilityIcon v={paste.visibility} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {visibilityLabel(paste.visibility)}
            </TooltipContent>
          </Tooltip>

          {/* Views */}
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {paste.viewCount}
          </span>

          {/* Time */}
          <span>{formatRelativeTime(paste.createdAt)}</span>

          {/* Right-aligned badges — icon-only with tooltips */}
          <div className="ml-auto flex items-center gap-2">
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
      </div>
    </motion.button>
  )
}
