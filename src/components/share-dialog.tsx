'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Clock, Copy, ExternalLink, Flame, KeyRound, Plus, Terminal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { shareUrl, rawUrl } from '@/lib/api-client'
import { formatBytes, formatDate, formatRelativeTime } from '@/lib/ui-utils'
import type { SafePaste } from '@/lib/types'

export type CreatedPaste = SafePaste & { url?: string; rawUrl?: string }

/** Copy text to the clipboard with a toast; falls back for non-secure contexts. */
export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (!ok) {
      toast.error('Could not copy — select the text and copy it manually')
      return
    }
  }
  toast.success(label)
}

function CopyRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-3 px-2.5 py-2">
          {icon}
          <input
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
            aria-label={label}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1.5"
          onClick={async () => {
            await copyText(value, `${label} copied`)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </Button>
      </div>
    </div>
  )
}

/**
 * Shown right after a paste/file is created: the share link, raw link and
 * any caveats (burn-after-read, password). Opening a burn-after-read paste
 * as a guest would destroy it, so the dialog says so instead of navigating.
 */
export function ShareDialog({
  pastes,
  open,
  onOpenChange,
  onView,
  onNew,
  isLoggedIn,
}: {
  pastes: CreatedPaste[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onView: (slug: string) => void
  onNew: () => void
  isLoggedIn: boolean
}) {
  const first = pastes[0]
  if (!first) return null
  const multiple = pastes.length > 1
  const isFile = first.contentType === 'file'
  const link = first.url || shareUrl(first.slug)
  const raw = first.rawUrl || (isFile ? `${window.location.origin}/api/file?id=${first.slug}` : rawUrl(first.slug))
  const burn = pastes.some((p) => p.burnAfterRead)
  const locked = pastes.some((p) => p.hasPassword)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Check className="h-4 w-4" />
            </span>
            {multiple ? `${pastes.length} files uploaded` : isFile ? 'File uploaded' : 'Paste created'}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? 'Each file has its own link.'
              : 'Share this link. Anyone with it can open the paste (subject to its settings).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {multiple ? (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {pastes.map((p) => (
                <CopyRow
                  key={p.id}
                  label={`${p.originalFileName || p.slug} · ${formatBytes(p.fileSizeBytes)}`}
                  value={p.url || shareUrl(p.slug)}
                />
              ))}
            </div>
          ) : (
            <>
              <CopyRow label="Share link" value={link} icon={<ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand" />} />
              <CopyRow
                label={isFile ? 'Direct download' : 'Raw text'}
                value={raw}
                icon={<Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              />
            </>
          )}

          {burn && (
            <div className="flex gap-2 rounded-md border border-brand-2/40 bg-brand-2/5 p-3 text-xs">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-brand-2" />
              <p>
                <span className="font-medium text-foreground">Burn after read.</span>{' '}
                The first person to open the link gets the content and it is then deleted forever.
                {isLoggedIn
                  ? ' As the owner you can open it without burning it.'
                  : " Don't open it yourself — send the link to the recipient."}
              </p>
            </div>
          )}
          {locked && (
            <div className="flex gap-2 rounded-md border border-border bg-surface-3 p-3 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Password protected — share the password through a different channel than the link.</p>
            </div>
          )}
          {!multiple && first.expiresAt && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={formatDate(first.expiresAt)}>
              <Clock className="h-3.5 w-3.5" /> Expires {formatRelativeTime(first.expiresAt)}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> New paste
          </Button>
          {!multiple && (
            <Button
              onClick={() => onView(first.slug)}
              className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <ExternalLink className="h-4 w-4" /> Open paste
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
