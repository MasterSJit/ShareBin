'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CodeEditor } from '@/components/editor/code-editor'
import { AdSlot } from '@/components/ad-slot'
import { PasteCard } from '@/components/paste-card'
import { FilePreview } from '@/components/file-preview'
import { api, ApiError, markUnlocked } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatBytes, formatRelativeTime, formatDate } from '@/lib/ui-utils'
import type { SafePaste } from '@/lib/types'
import { toast } from 'sonner'
import {
  Lock,
  Globe,
  Link as LinkIcon,
  Flame,
  Copy,
  Code,
  Share2,
  Download,
  FileText,
  Trash2,
  Pencil,
  FileQuestion,
  Flag,
  Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Reveal,
  StaggerGroup,
  AnimatedNumber,
  fadeUp,
  scaleIn,
} from '@/components/motion-helpers'

type PasteWithGate = SafePaste & { passwordRequired?: boolean }

const MAX_ATTEMPTS = 5

export function PasteView({ idOrSlug }: { idOrSlug: string }) {
  const goBrowse = useAppStore((s) => s.goBrowse)
  const user = useAppStore((s) => s.user)

  const [paste, setPaste] = useState<PasteWithGate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [gone, setGone] = useState(false)

  const [passwordInput, setPasswordInput] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [shakeKey, setShakeKey] = useState(0)

  const [related, setRelated] = useState<SafePaste[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch the paste on mount (parent remounts via key on slug change).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    setGone(false)
    setPaste(null)
    setRelated([])
    setUnlockError(null)
    setAttemptsLeft(MAX_ATTEMPTS)

    api
      .getPaste(idOrSlug)
      .then((rows) => {
        if (!alive) return
        const p = rows[0]
        if (!p) {
          setNotFound(true)
          return
        }
        setPaste(p)
        if (!p.passwordRequired && p.language) loadRelated(p)
      })
      .catch((e: unknown) => {
        if (!alive) return
        if (e instanceof ApiError) {
          if (e.status === 404) setNotFound(true)
          else if (e.status === 410) setGone(true)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    function loadRelated(p: SafePaste) {
      api
        .listPastes({ scope: 'language', language: p.language, pageSize: 4 })
        .then((list) => {
          if (alive) setRelated(list.filter((r) => r.id !== p.id).slice(0, 3))
        })
        .catch(() => {
          /* related is optional */
        })
    }

    return () => {
      alive = false
    }
  }, [idOrSlug])

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!paste || unlocking || attemptsLeft <= 0) return
    setUnlocking(true)
    setUnlockError(null)
    try {
      await api.unlockPaste(paste.id, passwordInput)
      markUnlocked(paste.id)
      toast.success('Unlocked')
      setPasswordInput('')
      // Re-fetch — the x-unlocked header is now attached automatically.
      const rows = await api.getPaste(idOrSlug)
      const fresh = rows[0]
      if (fresh) {
        setPaste(fresh)
        if (fresh.language) {
          api
            .listPastes({ scope: 'language', language: fresh.language, pageSize: 4 })
            .then((list) =>
              setRelated(list.filter((r) => r.id !== fresh.id).slice(0, 3)),
            )
            .catch(() => {})
        }
      }
    } catch (e: unknown) {
      const next = attemptsLeft - 1
      setAttemptsLeft(next)
      setShakeKey((k) => k + 1)
      if (e instanceof ApiError && e.status === 401) {
        setUnlockError(
          next > 0
            ? `Incorrect password. ${next} attempt${next === 1 ? '' : 's'} remaining.`
            : 'No attempts remaining. Please contact the paste owner.',
        )
      } else {
        setUnlockError('Failed to unlock paste. Please try again.')
      }
    } finally {
      setUnlocking(false)
    }
  }

  async function handleCopy() {
    if (!paste?.textContent) return
    try {
      await navigator.clipboard.writeText(paste.textContent)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  async function handleShare() {
    if (!paste) return
    try {
      await navigator.clipboard.writeText(paste.slug)
      toast.success(`Share code: ${paste.slug} copied`)
    } catch {
      toast.error('Failed to copy share code')
    }
  }

  async function handleDelete() {
    if (!paste || deleting) return
    setDeleting(true)
    try {
      await api.deletePaste(paste.id)
      toast.success('Paste deleted')
      goBrowse()
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to delete paste')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  // --- State: loading ---
  if (loading) return <PasteSkeleton />

  // --- State: not found ---
  if (notFound)
    return (
      <StateCard
        icon={FileQuestion}
        title="Paste not found"
        description="It may have been deleted."
        onBack={goBrowse}
      />
    )

  // --- State: gone (expired/burned before any content returned) ---
  if (gone)
    return (
      <StateCard
        icon={Flame}
        iconClassName="text-brand-2"
        title="This paste is gone."
        description="It expired or was burned after reading."
        onBack={goBrowse}
      />
    )

  if (!paste) return null

  // --- State: password gate ---
  if (paste.passwordRequired) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <div className="flex min-h-[60vh] items-center justify-center">
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: unlockError ? [0, -8, 8, -6, 6, 0] : 0,
            }}
            transition={{
              opacity: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
              y: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
              scale: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
              x: { duration: 0.45, ease: 'easeInOut' },
            }}
            className="surface glow-brand w-full max-w-md rounded-2xl p-8"
          >
            <div className="flex flex-col items-center text-center">
              <div className="animate-glow-pulse flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                {paste.title || `/${paste.slug}`}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                password protected
              </p>
            </div>

            <form onSubmit={handleUnlock} className="mt-6 space-y-3">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  disabled={unlocking || attemptsLeft <= 0}
                  aria-label="Paste password"
                  className="h-10 border-border bg-surface-3 pl-9 text-sm focus-visible:ring-1 focus-visible:ring-brand focus-visible:border-brand"
                />
              </div>

              {unlockError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {unlockError}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={unlocking || attemptsLeft <= 0 || passwordInput.length === 0}
                className="btn-shine h-10 w-full gap-2 rounded-md bg-brand text-brand-foreground hover:bg-brand"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Unlocking…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" /> Unlock
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    )
  }

  // --- State: full view ---
  const isOwner = !!user && !!paste.ownerId && user.id === paste.ownerId
  const isFile = paste.contentType === 'file'
  const visMeta = visibilityMeta(paste.visibility)
  const title =
    paste.title ||
    (isFile ? paste.originalFileName || `/${paste.slug}` : `/${paste.slug}`)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      {/* Burn-after-read banner (above content) */}
      {paste.burnAfterRead && (
        <Reveal className="mb-4">
          <div
            className="surface flex items-center gap-3 rounded-xl border border-brand-2/30 p-3"
            role="alert"
          >
            <Flame className="h-5 w-5 shrink-0 animate-pulse-soft text-brand-2" />
            <p className="text-sm text-foreground">
              Burned — this paste was permanently deleted after reading.
            </p>
          </div>
        </Reveal>
      )}

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* ===== Main column ===== */}
        <div className="min-w-0 lg:col-span-2">
          {/* Header block */}
          <Reveal variant={fadeUp} className="mb-4">
            <span className="font-mono text-xs text-muted-foreground">
              {'>'} cat /p/{paste.slug}
            </span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {paste.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {paste.description}
              </p>
            )}
            {paste.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {paste.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Reveal>

          {/* Action bar */}
          <Reveal variant={fadeUp} delay={0.05} className="mb-3">
            <div className="surface flex flex-wrap items-center gap-1 rounded-lg p-2">
              {paste.contentType === 'text' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!paste.textContent}
                    className="gap-1.5 text-sm hover:bg-surface-3"
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="gap-1.5 text-sm hover:bg-surface-3"
                  >
                    <a
                      href={`/api/paste/raw?id=${encodeURIComponent(paste.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Code className="h-4 w-4" /> Raw
                    </a>
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="gap-1.5 text-sm hover:bg-surface-3"
              >
                <Share2 className="h-4 w-4" /> Share
              </Button>

              {isOwner && (
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.message('Use Dashboard to edit')}
                    className="gap-1.5 text-sm hover:bg-surface-3"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      className="gap-1.5 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this paste?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The paste &ldquo;
                          {paste.title || paste.slug}&rdquo; will be permanently
                          removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {deleting ? 'Deleting…' : 'Delete paste'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </Reveal>

          {/* paste-top sponsored slot */}
          <AdSlot slot="paste-top" className="mb-3" />

          {/* Content */}
          {paste.contentType === 'text' ? (
            <Reveal variant={scaleIn} delay={0.1}>
              <div className="surface min-h-[500px] overflow-hidden rounded-lg">
                {/* Editor top bar (terminal strip) */}
                <div className="terminal-strip flex h-9 items-center gap-2 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {paste.language}
                  </span>
                  <span className="ml-auto rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand">
                    read-only
                  </span>
                </div>
                <CodeEditor
                  value={paste.textContent || ''}
                  language={paste.language}
                  readOnly
                  height={600}
                />
              </div>
            </Reveal>
          ) : (
            <Reveal variant={scaleIn} delay={0.1}>
              <FilePreview
                slug={paste.slug}
                fileName={paste.originalFileName}
                mimeType={paste.mimeType}
                fileSizeBytes={paste.fileSizeBytes ?? null}
                hasPassword={paste.hasPassword}
                isOwner={!!user && user.id === paste.ownerId}
                isBurned={paste.isBurned}
              />
            </Reveal>
          )}

          {/* paste-bottom sponsored slot */}
          <AdSlot slot="paste-bottom" className="mt-4" />
        </div>

        {/* ===== Sidebar ===== */}
        <aside className="lg:col-span-1">
          <Reveal variant={fadeUp} delay={0.1}>
            <div className="surface-2 sticky top-24 rounded-xl p-5">
              <div className="space-y-4">
                {/* Owner row */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-semibold text-brand-foreground">
                    {(paste.ownerName || 'G').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {paste.ownerName || 'Guest'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      owner
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Visibility">
                    <span className="flex items-center gap-1 truncate">
                      <visMeta.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {visMeta.label}
                    </span>
                  </Stat>
                  <Stat label="Language">
                    <span className="truncate font-mono">{paste.language}</span>
                  </Stat>
                  <Stat label="Views">
                    <AnimatedNumber
                      value={paste.viewCount}
                      className="font-mono tabular-nums"
                    />
                  </Stat>
                  <Stat label="Type">
                    <span className="truncate capitalize">{paste.contentType}</span>
                  </Stat>
                  <Stat label="Created" full>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate">
                          {formatRelativeTime(paste.createdAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{formatDate(paste.createdAt)}</TooltipContent>
                    </Tooltip>
                  </Stat>
                  <Stat label="Expires" full>
                    {paste.expiresAt ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help truncate">
                            {formatRelativeTime(paste.expiresAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{formatDate(paste.expiresAt)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>Never</span>
                    )}
                  </Stat>
                </div>

                {/* Badges */}
                {(paste.burnAfterRead || paste.hasPassword || paste.isFlagged) && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-1.5">
                      {paste.burnAfterRead && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-brand-2">
                          <Flame className="h-3 w-3" /> Burn
                        </span>
                      )}
                      {paste.hasPassword && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" /> Password
                        </span>
                      )}
                      {paste.isFlagged && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-destructive">
                          <Flag className="h-3 w-3" /> Flagged
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </aside>
      </div>

      {/* ===== Related ===== */}
      {related.length > 0 && (
        <Reveal variant={fadeUp} className="mt-10">
          <section>
            <span className="font-mono text-xs text-muted-foreground">
              More in {paste.language}
            </span>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              Related pastes
            </h3>
            <StaggerGroup
              stagger={0.06}
              className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {related.map((p) => (
                <Reveal key={p.id} variant={fadeUp}>
                  <PasteCard paste={p} />
                </Reveal>
              ))}
            </StaggerGroup>
          </section>
        </Reveal>
      )}
    </div>
  )
}

// ---------- helpers ----------

function visibilityMeta(v: string) {
  if (v === 'public') return { icon: Globe, label: 'Public' }
  if (v === 'unlisted') return { icon: LinkIcon, label: 'Unlisted' }
  return { icon: Lock, label: 'Private' }
}

function Stat({
  label,
  children,
  full,
}: {
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? 'col-span-2' : ''}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {children}
      </span>
    </div>
  )
}

function StateCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  onBack,
}: {
  icon: typeof FileQuestion
  iconClassName?: string
  title: string
  description: string
  onBack: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="surface w-full max-w-md rounded-2xl p-12 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-3">
            <Icon className={`h-8 w-8 ${iconClassName || 'text-muted-foreground'}`} />
          </div>
          <p className="mt-4 text-lg font-semibold tracking-tight">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button
            onClick={onBack}
            className="btn-shine mt-6 gap-1.5 rounded-md bg-brand text-brand-foreground hover:bg-brand"
          >
            Back to browse
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

function PasteSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-4 py-16 sm:px-6">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="brand-dot animate-pulse-soft" />
        <span className="font-mono text-sm text-muted-foreground">
          loading paste…
        </span>
      </div>
      <div className="w-full">
        <div className="shimmer h-96 w-full rounded-xl bg-surface" />
      </div>
    </div>
  )
}
