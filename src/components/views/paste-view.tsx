'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CodeEditor } from '@/components/editor/code-editor'
import { AdSlot } from '@/components/ad-slot'
import { PasteCard } from '@/components/paste-card'
import { FilePreview } from '@/components/file-preview'
import { copyText } from '@/components/share-dialog'
import { api, ApiError, shareUrl, rawUrl } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatBytes, formatRelativeTime, formatDate, LANGUAGES, languageLabel } from '@/lib/ui-utils'
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
  Trash2,
  Pencil,
  FileQuestion,
  Flag,
  Loader2,
  GitFork,
  Eye,
  BookOpen,
  Check,
  ShieldAlert,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Reveal,
  StaggerGroup,
  AnimatedNumber,
  fadeUp,
  scaleIn,
} from '@/components/motion-helpers'

const MAX_ATTEMPTS = 5

type Stage = 'loading' | 'not_found' | 'gone' | 'error' | 'password' | 'burn_confirm' | 'ready'

export function PasteView({ idOrSlug }: { idOrSlug: string }) {
  const goBrowse = useAppStore((s) => s.goBrowse)
  const goLogin = useAppStore((s) => s.goLogin)
  const cloneToNew = useAppStore((s) => s.cloneToNew)
  const user = useAppStore((s) => s.user)

  const [stage, setStage] = useState<Stage>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [paste, setPaste] = useState<SafePaste | null>(null)
  const [revealing, setRevealing] = useState(false)

  const [passwordInput, setPasswordInput] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [shakeKey, setShakeKey] = useState(0)

  const [related, setRelated] = useState<SafePaste[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [renderMarkdown, setRenderMarkdown] = useState(true)

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 404) return setStage('not_found')
      if (e.status === 410) return setStage('gone')
      if (e.status === 401) {
        setErrorMessage('This paste is private. Log in to view it.')
        return setStage('error')
      }
      setErrorMessage(e.message)
    } else {
      setErrorMessage('Could not load this paste.')
    }
    setStage('error')
  }, [])

  const loadRelated = useCallback((p: SafePaste) => {
    if (p.contentType !== 'text' || !p.language || p.language === 'plaintext') return
    api
      .listPastes({ scope: 'language', language: p.language, pageSize: 4 })
      .then((list) => setRelated(list.filter((r) => r.id !== p.id).slice(0, 3)))
      .catch(() => {
        /* related is optional */
      })
  }, [])

  /** Fetch the full paste (counts a view; burns burn-after-read text). */
  const reveal = useCallback(async () => {
    setRevealing(true)
    try {
      const rows = await api.getPaste(idOrSlug)
      const p = rows[0]
      if (!p) return setStage('not_found')
      if (p.passwordRequired) {
        setPaste(p)
        return setStage('password')
      }
      setPaste(p)
      setStage('ready')
      loadRelated(p)
    } catch (e) {
      handleError(e)
    } finally {
      setRevealing(false)
    }
  }, [idOrSlug, handleError, loadRelated])

  // Peek first: metadata only, never burns. Decide which screen to show.
  const load = useCallback(async () => {
    setStage('loading')
    setRelated([])
    try {
      const rows = await api.peekPaste(idOrSlug)
      const p = rows[0]
      if (!p) return setStage('not_found')
      setPaste(p)
      if (p.passwordRequired) return setStage('password')
      if (p.burnPending && p.contentType === 'text') return setStage('burn_confirm')
      await reveal()
    } catch (e) {
      handleError(e)
    }
  }, [idOrSlug, reveal, handleError])

  useEffect(() => {
    setUnlockError(null)
    setAttemptsLeft(MAX_ATTEMPTS)
    load()
  }, [load])

  // Reflect the paste title in the browser tab.
  useEffect(() => {
    if (!paste || stage !== 'ready') return
    const prev = document.title
    document.title = `${paste.title || paste.originalFileName || paste.slug} — ${prev.split(' — ')[0]}`
    return () => {
      document.title = prev
    }
  }, [paste, stage])

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!paste || unlocking || attemptsLeft <= 0) return
    setUnlocking(true)
    setUnlockError(null)
    try {
      await api.unlockPaste(paste.id, passwordInput)
      toast.success('Unlocked')
      setPasswordInput('')
      await reveal()
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
      } else if (e instanceof ApiError && e.status === 429) {
        setUnlockError(e.message)
      } else {
        setUnlockError('Failed to unlock paste. Please try again.')
      }
    } finally {
      setUnlocking(false)
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
  if (stage === 'loading') return <PasteSkeleton />

  if (stage === 'not_found')
    return (
      <StateCard
        icon={FileQuestion}
        title="Paste not found"
        description="It may have been deleted, or the link is mistyped."
        onBack={goBrowse}
      />
    )

  if (stage === 'gone')
    return (
      <StateCard
        icon={Flame}
        iconClassName="text-brand-2"
        title="This paste is gone."
        description="It expired or was burned after reading."
        onBack={goBrowse}
      />
    )

  if (stage === 'error')
    return (
      <StateCard
        icon={ShieldAlert}
        title="Can't open this paste"
        description={errorMessage || 'Something went wrong.'}
        onBack={goBrowse}
        action={!user ? { label: 'Log in', onClick: goLogin } : undefined}
      />
    )

  if (!paste) return null

  // --- State: password gate ---
  if (stage === 'password') {
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
                {paste.title || paste.originalFileName || `/${paste.slug}`}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                password protected {paste.contentType === 'file' ? 'file' : 'paste'}
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

  // --- State: burn-after-read confirmation (nothing has been burned yet) ---
  if (stage === 'burn_confirm') {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <div className="flex min-h-[60vh] items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="surface w-full max-w-md rounded-2xl border border-brand-2/30 p-8 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-2/15 text-brand-2">
              <Flame className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              {paste.title || `/${paste.slug}`}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This paste will <span className="text-brand-2">self-destruct</span> once you open it. Make sure you&apos;re
              ready to read or copy it — it can&apos;t be opened again.
            </p>
            <Button
              onClick={reveal}
              disabled={revealing}
              className="btn-shine mt-6 w-full gap-2 bg-brand-2 text-white hover:bg-brand-2/90"
            >
              {revealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Show paste
            </Button>
            <button type="button" onClick={goBrowse} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
              Not now
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  // --- State: full view ---
  const isOwner = !!paste.isOwner || (!!user && !!paste.ownerId && user.id === paste.ownerId)
  const isFile = paste.contentType === 'file'
  const visMeta = visibilityMeta(paste.visibility)
  const title =
    paste.title ||
    (isFile ? paste.originalFileName || `/${paste.slug}` : `/${paste.slug}`)
  const isMarkdown = !isFile && paste.language === 'markdown'
  const justBurned = paste.isBurned
  const text = paste.textContent || ''

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
              {justBurned
                ? 'Burned — this paste has been permanently deleted from the server. Copy it now if you need it.'
                : isOwner
                  ? 'Burn after read is on. You are the owner, so your views don’t burn it — the first other reader will.'
                  : isFile
                    ? 'Burn after read — this file is deleted after its first download.'
                    : 'Burn after read is on for this paste.'}
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
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight md:text-3xl">
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
            <div className="surface flex flex-wrap items-center gap-0.5 rounded-lg p-1.5 sm:gap-1 sm:p-2">
              {!isFile && (
                <>
                  <ActionButton icon={Copy} label="Copy" onClick={() => copyText(text, 'Copied to clipboard')} disabled={!text} />
                  {!justBurned && (
                    <ActionButton icon={Code} label="Raw" href={rawUrl(paste.slug)} external />
                  )}
                  <ActionButton icon={Download} label="Download" onClick={() => downloadText(paste)} disabled={!text} />
                  <ActionButton
                    icon={GitFork}
                    label="Clone"
                    title="Open a new paste pre-filled with this content"
                    onClick={() =>
                      cloneToNew({
                        title: paste.title ? `Copy of ${paste.title}` : '',
                        description: paste.description || '',
                        tags: paste.tags.join(', '),
                        language: paste.language,
                        textContent: text,
                      })
                    }
                    disabled={!text}
                  />
                </>
              )}
              {!justBurned && (
                <ActionButton icon={Share2} label="Copy link" onClick={() => copyText(shareUrl(paste.slug), 'Link copied')} />
              )}
              {isMarkdown && (
                <ActionButton
                  icon={renderMarkdown ? Code : BookOpen}
                  label={renderMarkdown ? 'Source' : 'Rendered'}
                  onClick={() => setRenderMarkdown((v) => !v)}
                />
              )}

              <div className="ml-auto flex items-center gap-1">
                {isOwner && !justBurned ? (
                  <>
                    <ActionButton icon={Pencil} label="Edit" onClick={() => setEditOpen(true)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      aria-label="Delete"
                      title="Delete"
                      className="gap-1.5 px-2.5 text-sm text-destructive hover:bg-destructive/10 sm:px-3"
                    >
                      <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </>
                ) : (
                  !justBurned && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReportOpen(true)}
                      aria-label="Report"
                      title="Report"
                      className="gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-destructive sm:px-3"
                    >
                      <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Report</span>
                    </Button>
                  )
                )}
              </div>
            </div>
          </Reveal>

          {/* paste-top sponsored slot */}
          <AdSlot slot="paste-top" className="mb-3" />

          {/* Content */}
          {!isFile ? (
            <Reveal variant={scaleIn} delay={0.1}>
              <div className="surface min-h-[300px] overflow-hidden rounded-lg">
                {/* Editor top bar (terminal strip) */}
                <div className="terminal-strip flex h-9 items-center gap-2 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {languageLabel(paste.language)}
                  </span>
                  <span className="ml-auto rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand">
                    read-only
                  </span>
                </div>
                {isMarkdown && renderMarkdown ? (
                  <div className="markdown-body max-h-[70vh] overflow-auto p-6">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                ) : (
                  <CodeEditor
                    value={text}
                    language={paste.language}
                    readOnly
                    height={Math.min(640, Math.max(240, (paste.lineCount || 10) * 19 + 32))}
                  />
                )}
              </div>
            </Reveal>
          ) : (
            <Reveal variant={scaleIn} delay={0.1}>
              <FilePreview
                slug={paste.slug}
                fileName={paste.originalFileName ?? null}
                mimeType={paste.mimeType ?? null}
                fileSizeBytes={paste.fileSizeBytes ?? null}
                burnPending={!!paste.burnPending}
              />
            </Reveal>
          )}

          {/* paste-bottom sponsored slot */}
          <AdSlot slot="paste-bottom" className="mt-4" />
        </div>

        {/* ===== Sidebar ===== */}
        <aside className="mt-6 lg:col-span-1 lg:mt-0">
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
                      {isOwner && <span className="ml-1.5 text-[11px] text-brand">(you)</span>}
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
                  <Stat label={isFile ? 'Type' : 'Language'}>
                    <span className="truncate font-mono">
                      {isFile ? paste.mimeType || 'file' : languageLabel(paste.language)}
                    </span>
                  </Stat>
                  <Stat label="Views">
                    <AnimatedNumber
                      value={paste.viewCount}
                      className="font-mono tabular-nums"
                    />
                  </Stat>
                  <Stat label="Size">
                    <span className="font-mono">{formatBytes(paste.sizeBytes ?? paste.fileSizeBytes ?? 0)}</span>
                  </Stat>
                  {!isFile && (
                    <Stat label="Lines">
                      <span className="font-mono tabular-nums">{(paste.lineCount ?? 0).toLocaleString()}</span>
                    </Stat>
                  )}
                  {!isFile && (
                    <Stat label="Characters">
                      <span className="font-mono tabular-nums">{text.length.toLocaleString()}</span>
                    </Stat>
                  )}
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

                {!justBurned && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Share</span>
                      <button
                        type="button"
                        onClick={() => copyText(shareUrl(paste.slug), 'Link copied')}
                        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
                        title="Copy link"
                      >
                        <span className="min-w-0 flex-1 truncate">{shareUrl(paste.slug)}</span>
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
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
              More in {languageLabel(paste.language)}
            </span>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">
              Related pastes
            </h3>
            <StaggerGroup
              stagger={0.06}
              className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {related.map((p) => (
                <Reveal key={p.id} variant={fadeUp} className="h-full">
                  <PasteCard paste={p} />
                </Reveal>
              ))}
            </StaggerGroup>
          </section>
        </Reveal>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paste?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. &ldquo;{paste.title || paste.slug}&rdquo;
              {isFile ? ' and its file' : ''} will be permanently removed.
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

      {isOwner && (
        <EditPasteDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          paste={paste}
          onSaved={(p) => setPaste((cur) => (cur ? { ...cur, ...p, isOwner: true } : p))}
        />
      )}

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} pasteId={paste.id} />
    </div>
  )
}

// ---------- helpers ----------

/** Save a text paste as a file named after its title + language extension. */
function downloadText(p: SafePaste) {
  // The server knows the right extension; ?dl=1 makes it an attachment.
  // Burned pastes are gone server-side, so build the file locally instead.
  if (!p.isBurned && !p.hasPassword) {
    const a = document.createElement('a')
    a.href = `${rawUrl(p.slug)}?dl=1`
    a.click()
    return
  }
  const blob = new Blob([p.textContent || ''], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(p.title || p.slug).replace(/[^\w.-]+/g, '_')}.txt`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  external,
  disabled,
  title,
}: {
  icon: typeof Copy
  label: string
  onClick?: () => void
  href?: string
  external?: boolean
  disabled?: boolean
  title?: string
}) {
  if (href) {
    return (
      <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2.5 text-sm hover:bg-surface-3 sm:px-3">
        <a href={href} target={external ? '_blank' : undefined} rel="noreferrer" title={title || label} aria-label={label}>
          <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
        </a>
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={label}
      className="gap-1.5 px-2.5 text-sm hover:bg-surface-3 sm:px-3"
    >
      <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}

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
  action,
}: {
  icon: typeof FileQuestion
  iconClassName?: string
  title: string
  description: string
  onBack: () => void
  action?: { label: string; onClick: () => void }
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
          <div className="mt-6 flex justify-center gap-2">
            {action && (
              <Button onClick={action.onClick} className="btn-shine gap-1.5 rounded-md bg-brand text-brand-foreground hover:bg-brand">
                {action.label}
              </Button>
            )}
            <Button
              onClick={onBack}
              variant={action ? 'ghost' : 'default'}
              className={action ? '' : 'btn-shine gap-1.5 rounded-md bg-brand text-brand-foreground hover:bg-brand'}
            >
              Back to browse
            </Button>
          </div>
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

/* ---------------- Edit (owner) ---------------- */

const FIELD_LABEL = 'font-mono text-[11px] uppercase tracking-wider text-muted-foreground'

function EditPasteDialog({
  open,
  onOpenChange,
  paste,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  paste: SafePaste
  onSaved: (p: SafePaste) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [visibility, setVisibility] = useState('public')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const isText = paste.contentType === 'text'

  useEffect(() => {
    if (!open) return
    setTitle(paste.title || '')
    setDescription(paste.description || '')
    setTags(paste.tags.join(', '))
    setLanguage(paste.language)
    setVisibility(paste.visibility)
    setContent(paste.textContent || '')
  }, [open, paste])

  async function save() {
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {
        title: title.trim() || null,
        description: description.trim() || null,
        tags,
        visibility,
      }
      if (isText) {
        patch.language = language
        if (content !== (paste.textContent || '')) patch.textContent = content
      }
      const rows = await api.updatePaste(paste.id, patch)
      if (rows[0]) {
        onSaved(rows[0])
        toast.success('Paste updated')
        onOpenChange(false)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit paste</DialogTitle>
          <DialogDescription>
            Changes apply to <span className="font-mono text-foreground">/p/{paste.slug}</span> immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ep-title" className={FIELD_LABEL}>Title</Label>
            <Input id="ep-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} className="bg-surface-3" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ep-desc" className={FIELD_LABEL}>Description</Label>
            <Input id="ep-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="bg-surface-3" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-tags" className={FIELD_LABEL}>Tags</Label>
            <Input id="ep-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rust, api" className="bg-surface-3" />
          </div>
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL}>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="w-full bg-surface-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isText && (
            <>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={FIELD_LABEL}>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full bg-surface-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-hidden rounded-lg border border-border sm:col-span-2">
                <CodeEditor value={content} onChange={(v) => setContent(v ?? '')} language={language} height={320} onSubmitShortcut={save} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || (isText && !content.trim())} className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Report ---------------- */

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'malware', label: 'Malware or exploit' },
  { value: 'phishing', label: 'Phishing / scam' },
  { value: 'personal_info', label: 'Personal or private information' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'other', label: 'Something else' },
]

function ReportDialog({ open, onOpenChange, pasteId }: { open: boolean; onOpenChange: (o: boolean) => void; pasteId: string }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    try {
      const rows = await api.reportPaste(pasteId, reason, details.trim() || undefined)
      void rows
      toast.success('Thanks — moderators will review it')
      onOpenChange(false)
      setDetails('')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send the report')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this paste</DialogTitle>
          <DialogDescription>Reports go to the site moderators. The paste stays up until they review it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL}>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full bg-surface-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-details" className={FIELD_LABEL}>Details (optional)</Label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-md border border-border bg-surface-3 p-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending} className="gap-1.5 bg-destructive text-white hover:bg-destructive/90">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
