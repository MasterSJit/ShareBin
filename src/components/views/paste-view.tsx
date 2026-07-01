'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
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
} from 'lucide-react'

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
        icon={SearchX}
        title="Paste not found"
        description="The paste you're looking for doesn't exist, has been deleted, or the link is incorrect."
        onBack={goBrowse}
      />
    )

  // --- State: gone (expired/burned before any content returned) ---
  if (gone)
    return (
      <StateCard
        icon={Ghost}
        title="This paste is gone"
        description="This paste has expired or was burned after reading and is no longer available."
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
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={goBrowse} className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Button>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">
                {paste.title || `/${paste.slug}`}
              </CardTitle>
              <CardDescription>
                This paste is password-protected. Enter the password to view its contents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUnlock} className="space-y-3">
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  disabled={unlocking || attemptsLeft <= 0}
                  aria-label="Paste password"
                />
                {unlockError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> {unlockError}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining
                  </span>
                  <span className="font-mono">{paste.language}</span>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={unlocking || attemptsLeft <= 0 || passwordInput.length === 0}
                >
                  {unlocking ? 'Unlocking…' : 'Unlock paste'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // --- State: full view ---
  const isOwner = !!user && !!paste.ownerId && user.id === paste.ownerId
  const visMeta = visibilityMeta(paste.visibility)
  const showBurnedBanner = paste.burnAfterRead && paste.isBurned
  const showBurnWarning = paste.burnAfterRead && !paste.isBurned
  const showExpiredBanner = paste.isExpired && !paste.isBurned

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={goBrowse} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Button>

      {/* Status banners */}
      {showBurnedBanner && (
        <AlertBanner tone="amber" icon={Flame} title="This paste was burned after reading">
          It has been permanently deleted from the server. The content shown below is the only
          remaining copy.
        </AlertBanner>
      )}
      {showBurnWarning && (
        <AlertBanner tone="amber" icon={Flame} title="Burn after read — caution">
          Viewing this paste has triggered permanent deletion. It cannot be recovered once you
          leave this page.
        </AlertBanner>
      )}
      {showExpiredBanner && (
        <AlertBanner tone="red" icon={Hourglass} title="This paste has expired">
          It is no longer accessible to new viewers.
        </AlertBanner>
      )}
      {paste.isFlagged && (
        <AlertBanner tone="red" icon={ShieldAlert} title="This paste has been flagged">
          It was flagged by a moderator and may violate community guidelines.
        </AlertBanner>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Main column */}
        <div className="min-w-0">
          {/* Title + description + tags */}
          <div className="mb-4">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {paste.title || (paste.contentType === 'file' ? paste.originalFileName : `/${paste.slug}`)}
              </h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {paste.contentType === 'file' ? 'file' : paste.language}
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
                  <Badge key={t} variant="outline" className="text-xs">
                    #{t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action bar (text pastes only) */}
          {paste.contentType === 'text' && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!paste.textContent}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/paste/raw?id=${encodeURIComponent(paste.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Code className="h-4 w-4" /> Raw
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          )}

          {/* Content */}
          {paste.contentType === 'text' ? (
            <div className="overflow-hidden rounded-lg border bg-[#1e1e1e]">
              <CodeEditor
                value={paste.textContent || ''}
                language={paste.language}
                readOnly
                height="600px"
              />
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {paste.originalFileName || `/${paste.slug}`}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatBytes(paste.fileSizeBytes)}
                    {paste.mimeType ? ` · ${paste.mimeType}` : ''}
                  </p>
                </div>
                <Button onClick={handleDownload} className="gap-1.5">
                  <Download className="h-4 w-4" /> Download
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Related pastes */}
          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> More in {paste.language}
              </h2>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                {related.map((p) => (
                  <PasteCard key={p.id} paste={p} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-16 lg:self-start">
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Owner */}
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {paste.ownerName
                      ? paste.ownerName.slice(0, 2).toUpperCase()
                      : <UserIcon className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {paste.ownerName || 'Guest'}
                  </p>
                  <p className="text-xs text-muted-foreground">Author</p>
                </div>
              </div>

              <Separator />

              <MetaRow icon={visMeta.icon} label="Visibility">
                <Badge variant="outline" className="gap-1 text-xs">
                  {visMeta.label}
                </Badge>
              </MetaRow>

              {paste.contentType === 'text' && (
                <MetaRow icon={Code} label="Language">
                  <span className="font-mono">{paste.language}</span>
                </MetaRow>
              )}

              <MetaRow icon={Eye} label="Views">{paste.viewCount}</MetaRow>

              <MetaRow icon={Calendar} label="Created">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{formatRelativeTime(paste.createdAt)}</span>
                  </TooltipTrigger>
                  <TooltipContent>{formatDate(paste.createdAt)}</TooltipContent>
                </Tooltip>
              </MetaRow>

              <MetaRow icon={Clock} label="Updated">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{formatRelativeTime(paste.updatedAt)}</span>
                  </TooltipTrigger>
                  <TooltipContent>{formatDate(paste.updatedAt)}</TooltipContent>
                </Tooltip>
              </MetaRow>

              <MetaRow icon={Hourglass} label="Expires">
                {paste.expiresAt ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">{formatRelativeTime(paste.expiresAt)}</span>
                    </TooltipTrigger>
                    <TooltipContent>{formatDate(paste.expiresAt)}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span>Never</span>
                )}
              </MetaRow>

              <Separator />

              <div className="flex flex-wrap gap-1.5">
                {paste.burnAfterRead && (
                  <Badge variant="destructive" className="gap-1 text-xs">
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
                    <ShieldAlert className="h-3 w-3" /> Flagged
                  </Badge>
                )}
                {paste.contentType === 'file' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <FileText className="h-3 w-3" /> File
                  </Badge>
                )}
              </div>

              {/* Owner actions */}
              {isOwner && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() =>
                        toast.message('Editing is not available in this view — use Dashboard.')
                      }
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

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Eye
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="min-w-0 max-w-[60%] truncate text-right font-medium">{children}</span>
    </div>
  )
}

function AlertBanner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'amber' | 'red'
  icon: typeof Flame
  title: string
  children: ReactNode
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'border-destructive/40 bg-destructive/10 text-destructive'
  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneClasses}`}
      role="alert"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
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
        <Card className="w-full max-w-md border-dashed">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
            <Button variant="outline" size="sm" onClick={onBack} className="mt-2 gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to browse
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PasteSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="mb-4 h-8 w-32" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
