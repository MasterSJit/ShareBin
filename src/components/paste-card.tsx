'use client'

import {
  ArrowRight,
  Clock,
  Eye,
  FileCode,
  FileText,
  Flag,
  Flame,
  Globe,
  Hash,
  Link as LinkIcon,
  Lock,
} from 'lucide-react'
import type { SafePaste } from '@/lib/types'
import { formatBytes, formatRelativeTime } from '@/lib/ui-utils'
import { useAppStore } from '@/lib/store'
import { TiltCard } from '@/components/motion-helpers'

function VisibilityIcon({ v }: { v: string }) {
  if (v === 'public') return <Globe className="h-3 w-3" />
  if (v === 'unlisted') return <LinkIcon className="h-3 w-3" />
  return <Lock className="h-3 w-3" />
}

export function PasteCard({ paste }: { paste: SafePaste }) {
  const goView = useAppStore((s) => s.goView)
  const isFile = paste.contentType === 'file'
  const title =
    paste.title ||
    (isFile ? paste.originalFileName || `/${paste.slug}` : `/${paste.slug}`)
  const initials = (paste.ownerName || 'G').slice(0, 2).toUpperCase()
  const preview =
    paste.contentType === 'text' && paste.textContent
      ? paste.textContent.slice(0, 280) +
        (paste.textContent.length > 280 ? '…' : '')
      : null

  function open() {
    goView(paste.slug)
  }
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  return (
    <TiltCard intensity={6} className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKey}
        className="group glass gradient-border lift glow-brand-hover relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Top gradient beam — intensifies on hover */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30 transition-transform duration-300 group-hover:scale-105">
            {isFile ? (
              <FileText className="h-5 w-5" />
            ) : (
              <FileCode className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {title}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {isFile ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <FileText className="h-2.5 w-2.5" />
                  {formatBytes(paste.fileSizeBytes)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand">
                  <Hash className="h-2.5 w-2.5" />
                  {paste.language}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {paste.description && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {paste.description}
          </p>
        )}

        {/* Text preview */}
        {preview && (
          <pre className="mt-3 max-h-24 overflow-hidden rounded-lg bg-muted/30 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {preview}
          </pre>
        )}

        {/* Badges */}
        {(paste.burnAfterRead || paste.hasPassword || paste.isFlagged) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {paste.burnAfterRead && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-2/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-2">
                <Flame className="h-2.5 w-2.5" /> Burn
              </span>
            )}
            {paste.hasPassword && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Lock className="h-2.5 w-2.5" /> Password
              </span>
            )}
            {paste.isFlagged && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                <Flag className="h-2.5 w-2.5" /> Flagged
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[8px] font-bold text-brand-foreground">
              {initials}
            </span>
            <span className="max-w-[80px] truncate">
              {paste.ownerName || 'guest'}
            </span>
          </div>
          <span className="flex items-center gap-1 capitalize">
            <VisibilityIcon v={paste.visibility} /> {paste.visibility}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {paste.viewCount}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatRelativeTime(paste.createdAt)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              open()
            }}
            className="btn-shine ml-auto inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-brand to-brand-2 px-2.5 py-1 text-[11px] font-semibold text-brand-foreground shadow-sm shadow-brand/30 transition-shadow hover:shadow-md hover:shadow-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Open
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </TiltCard>
  )
}
