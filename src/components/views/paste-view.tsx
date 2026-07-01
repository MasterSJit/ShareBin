'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { PasteCard } from '@/components/paste-card'
import { api, ApiError, getUnlockedHeader, markUnlocked } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatBytes, formatRelativeTime, formatDate } from '@/lib/ui-utils'
import type { SafePaste } from '@/lib/types'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Lock,
  Eye,
  Globe,
  Link as LinkIcon,
  Clock,
  Hourglass,
  Flame,
  Copy,
  Code,
  Share2,
  Download,
  FileText,
  Trash2,
  Pencil,
  AlertTriangle,
  ShieldAlert,
  User as UserIcon,
  Calendar,
  SearchX,
  Ghost,
  Sparkles,
  Loader2,
  Flag,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Reveal,
  StaggerGroup,
  AnimatedNumber,
  scaleIn,
  fadeUp,
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
  const [loadError, setLoadError] = useState<string | null>(null)

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
    setLoadError(null)
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
          else setLoadError(e.message)
        } else {
          setLoadError('Failed to load paste')
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
      toast.success('Unlocked 🔓')
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

  async function handleDownload() {
    if (!paste) return
    const headers: Record<string, string> = {}
    const unlocked = getUnlockedHeader()
    if (unlocked) headers['x-unlocked'] = unlocked
    try {
      const res = await fetch(api.fileDownloadUrl(paste.slug), {
        credentials: 'include',
        headers,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = paste.originalFileName || paste.slug
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Download started')
    } catch {
      toast.error('Download failed')
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
        icon={Ghost}
        title="Paste not found"
        description="The paste you're looking for doesn't exist, has been deleted, or the link is incorrect."
        onBack={goBrowse}
      />
    )

  // --- State: gone (expired/burned before any content returned) ---
  if (gone)
    return (
      <StateCard
        icon={Flame}
        title="This paste has expired or been burned."
        description="It is no longer available. Burned pastes are permanently deleted after their first read."
        onBack={goBrowse}
      />
    )

  // --- State: other load error ---
  if (loadError)
    return (
      <StateCard
        icon={AlertTriangle}
        title="Couldn't load paste"
        description={loadError}
        onBack={goBrowse}
      />
    )

  if (!paste) return null

  // --- State: password gate ---
  if (paste.passwordRequired) {
    const lowAttempts = attemptsLeft <= 2
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBrowse}
          className="mb-6 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Button>
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
            className="glass-strong glow-brand gradient-border w-full max-w-md rounded-2xl"
          >
            <CardHeader className="items-center text-center">
              <div className="animate-pulse-glow relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
                <Lock className="h-7 w-7 text-brand-foreground" />
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-brand to-brand-2 opacity-50 blur-md" />
              </div>
              <CardTitle className="text-xl">
                {paste.title || `/${paste.slug}`}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                This paste is password-protected. Enter the password to view its contents.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password"
                    autoFocus
                    disabled={unlocking || attemptsLeft <= 0}
                    aria-label="Paste password"
                    className="h-11 border-transparent bg-muted/30 pl-10 focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>

                {unlockError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-sm text-destructive"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {unlockError}
                  </motion.p>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`flex items-center gap-1.5 ${
                      lowAttempts ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining
                  </span>
                  <span className="font-mono text-muted-foreground">{paste.language}</span>
                </div>

                <Button
                  type="submit"
                  disabled={unlocking || attemptsLeft <= 0 || passwordInput.length === 0}
                  className="btn-shine h-11 w-full gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:shadow-brand/50"
                >
                  {unlocking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Unlocking…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Unlock paste
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </motion.div>
        </div>
      </div>
    )
  }

  // --- State: full view ---
  const isOwner = !!user && !!paste.ownerId && user.id === paste.ownerId
  const visMeta = visibilityMeta(paste.visibility)
  const showBurnBanner = paste.burnAfterRead

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Reveal className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBrowse}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Button>
      </Reveal>

      {/* Burn-after-read warning banner */}
      {showBurnBanner && (
        <Reveal className="mb-4">
          <div
            className="glass animate-pulse-glow flex items-start gap-3 rounded-xl border border-brand-2/40 p-4"
            role="alert"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-brand-2/20">
              <Flame className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                This paste was burned after reading — it is now permanently deleted.
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The content shown below is the only remaining copy. It cannot be recovered once you leave this page.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* Expired / flagged banners */}
      {paste.isExpired && !paste.isBurned && (
        <Reveal className="mb-4">
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
            role="alert"
          >
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">This paste has expired</p>
              <p className="mt-0.5 text-sm opacity-90">
                It is no longer accessible to new viewers.
              </p>
            </div>
          </div>
        </Reveal>
      )}
      {paste.isFlagged && (
        <Reveal className="mb-4">
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
            role="alert"
          >
            <Flag className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">This paste has been flagged</p>
              <p className="mt-0.5 text-sm opacity-90">
                It was flagged by a moderator and may violate community guidelines.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ===== Main column ===== */}
        <div className="min-w-0 lg:col-span-2">
          {/* Paste header */}
          <Reveal variant={fadeUp} className="mb-4">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-gradient">
                  {paste.title ||
                    (paste.contentType === 'file' ? paste.originalFileName : `/${paste.slug}`)}
                </span>
              </h1>
              <Badge
                variant="secondary"
                className="gap-1 bg-gradient-to-r from-brand/15 to-brand-2/15 font-mono text-xs"
              >
                {paste.contentType === 'file' ? (
                  <>
                    <FileText className="h-3 w-3" /> file
                  </>
                ) : (
                  <>
                    <Code className="h-3 w-3" /> {paste.language}
                  </>
                )}
              </Badge>
            </div>
            {paste.description && (
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {paste.description}
              </p>
            )}
            {paste.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {paste.tags.map((t) => (
                  <span
                    key={t}
                    className="glass rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Reveal>

          {/* Action bar */}
          {paste.contentType === 'text' && (
            <Reveal variant={fadeUp} delay={0.05} className="mb-3">
              <div className="glass flex flex-wrap items-center gap-2 rounded-xl p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!paste.textContent}
                  className="gap-1.5 bg-muted/40 hover:bg-brand/15 hover:text-brand"
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button variant="ghost" size="sm" asChild className="gap-1.5 bg-muted/40 hover:bg-brand/15 hover:text-brand">
                  <a
                    href={`/api/paste/raw?id=${encodeURIComponent(paste.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Code className="h-4 w-4" /> Raw
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="gap-1.5 bg-muted/40 hover:bg-brand/15 hover:text-brand"
                >
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </Reveal>
          )}

          {/* Content */}
          {paste.contentType === 'text' ? (
            <Reveal variant={scaleIn} delay={0.1}>
              <div className="glass min-h-[500px] overflow-hidden rounded-xl border border-border/50">
                {/* Editor top bar */}
                <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/70" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/70" />
                    <span className="h-3 w-3 rounded-full bg-brand/70" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {paste.language}
                  </span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    read-only
                  </span>
                </div>
                <div className="h-[600px]">
                  <CodeEditor
                    value={paste.textContent || ''}
                    language={paste.language}
                    readOnly
                    height="600px"
                  />
                </div>
              </div>
            </Reveal>
          ) : (
            <Reveal variant={scaleIn} delay={0.1}>
              <div className="glass flex flex-col items-center gap-5 rounded-2xl p-6 text-center sm:flex-row sm:text-left">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
                  <FileText className="h-10 w-10 text-brand-foreground" />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand to-brand-2 opacity-40 blur-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">
                    {paste.originalFileName || `/${paste.slug}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatBytes(paste.fileSizeBytes)}
                    {paste.mimeType ? ` · ${paste.mimeType}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted/30 px-2 py-0.5 font-mono">
                      {paste.mimeType || 'application/octet-stream'}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleDownload}
                  className="btn-shine gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:shadow-brand/50"
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </Reveal>
          )}

          {/* Related pastes */}
          {related.length > 0 && (
            <Reveal variant={fadeUp} className="mt-10">
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-brand" /> More in{' '}
                  <span className="text-gradient font-mono">{paste.language}</span>
                </h2>
                <StaggerGroup stagger={0.08} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((p) => (
                    <Reveal key={p.id} variant={scaleIn}>
                      <PasteCard paste={p} />
                    </Reveal>
                  ))}
                </StaggerGroup>
              </section>
            </Reveal>
          )}
        </div>

        {/* ===== Sidebar ===== */}
        <aside className="lg:col-span-1">
          <Reveal variant={fadeUp} delay={0.1} className="lg:sticky lg:top-20">
            <Card className="glass-strong gradient-border overflow-hidden rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Owner row */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-brand to-brand-2 text-xs font-semibold text-brand-foreground">
                      {paste.ownerName ? (
                        paste.ownerName.slice(0, 2).toUpperCase()
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {paste.ownerName || 'Guest'}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-brand">owner</p>
                  </div>
                </div>

                <Separator />

                {/* Stat tiles grid */}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={visMeta.icon} label="Visibility">
                    <span className="truncate">{visMeta.label}</span>
                  </StatTile>

                  <StatTile icon={Code} label="Language">
                    <span className="truncate font-mono text-xs">{paste.language}</span>
                  </StatTile>

                  <StatTile icon={Eye} label="Views">
                    <AnimatedNumber
                      value={paste.viewCount}
                      className="font-mono tabular-nums"
                    />
                  </StatTile>

                  <StatTile icon={FileText} label="Type">
                    <span className="truncate">{paste.contentType}</span>
                  </StatTile>

                  <StatTile icon={Calendar} label="Created" full>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help truncate">
                          {formatRelativeTime(paste.createdAt)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{formatDate(paste.createdAt)}</TooltipContent>
                    </Tooltip>
                  </StatTile>

                  <StatTile icon={Hourglass} label="Expires" full>
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
                  </StatTile>
                </div>

                {/* Badges row */}
                {(paste.burnAfterRead || paste.hasPassword || paste.isFlagged) && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-1.5">
                      {paste.burnAfterRead && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-brand-2/40 bg-brand-2/10 text-xs text-brand-2"
                        >
                          <Flame className="h-3 w-3" /> Burn{paste.isBurned ? 'ed' : ' after read'}
                        </Badge>
                      )}
                      {paste.hasPassword && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Lock className="h-3 w-3" /> Password
                        </Badge>
                      )}
                      {paste.isFlagged && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <Flag className="h-3 w-3" /> Flagged
                        </Badge>
                      )}
                    </div>
                  </>
                )}

                {/* Owner actions */}
                {isOwner && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 border-border/60 hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
                        onClick={() => toast.message('Open Dashboard to edit')}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => setDeleteOpen(true)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this paste?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The paste &ldquo;
                              {paste.title || paste.slug}&rdquo; will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
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
                  </>
                )}
              </CardContent>
              <CardFooter className="pt-0">
                <p className="w-full text-center font-mono text-[10px] text-muted-foreground">
                  /{paste.slug}
                </p>
              </CardFooter>
            </Card>
          </Reveal>
        </aside>
      </div>
    </div>
  )
}

// ---------- helpers ----------

function visibilityMeta(v: string) {
  if (v === 'public') return { icon: Globe, label: 'Public' }
  if (v === 'unlisted') return { icon: LinkIcon, label: 'Unlisted' }
  return { icon: Lock, label: 'Private' }
}

function StatTile({
  icon: Icon,
  label,
  children,
  full,
}: {
  icon: typeof Eye
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <div
      className={`glass flex flex-col gap-1 rounded-lg px-3 py-2 ${
        full ? 'col-span-2' : ''
      }`}
    >
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className="min-w-0 truncate text-sm font-medium">{children}</span>
    </div>
  )
}

function StateCard({
  icon: Icon,
  title,
  description,
  onBack,
}: {
  icon: typeof SearchX
  title: string
  description: string
  onBack: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass-strong gradient-border w-full max-w-md rounded-2xl"
        >
          <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand/15 to-brand-2/15">
              <Icon className="h-10 w-10 text-muted-foreground" />
              <div className="pointer-events-none absolute inset-0 rounded-full bg-brand/5 blur-xl" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold">{title}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
            </div>
            <Button
              onClick={onBack}
              className="btn-shine mt-2 gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:shadow-brand/50"
            >
              <ArrowLeft className="h-4 w-4" /> Back to browse
            </Button>
          </CardContent>
        </motion.div>
      </div>
    </div>
  )
}

function PasteSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-gradient text-lg font-semibold">Loading paste…</p>
      </div>
      <div className="w-full">
        <Skeleton className="mb-4 h-8 w-32 rounded-lg bg-muted/30" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Skeleton className="h-9 w-3/4 rounded-lg bg-muted/30" />
            <Skeleton className="h-4 w-full rounded bg-muted/25" />
            <Skeleton className="h-4 w-2/3 rounded bg-muted/25" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-lg bg-muted/30" />
              <Skeleton className="h-9 w-20 rounded-lg bg-muted/30" />
              <Skeleton className="h-9 w-20 rounded-lg bg-muted/30" />
            </div>
            <div className="shimmer glass h-[600px] w-full rounded-xl bg-muted/20" />
          </div>
          <div className="hidden lg:block">
            <Skeleton className="h-80 w-full rounded-2xl bg-muted/25" />
          </div>
        </div>
      </div>
    </div>
  )
}
