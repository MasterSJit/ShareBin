'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { PasteCard } from '@/components/paste-card'
import { EXPIRY_OPTIONS } from '@/lib/ui-utils'
import {
  AnimatedNumber,
  Reveal,
  StaggerGroup,
  fadeUp,
  scaleIn,
} from '@/components/motion-helpers'
import type { SafePaste, SafeUser } from '@/lib/types'

type FilterKey = 'all' | 'active' | 'expired' | 'burned' | 'flagged'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
  { key: 'burned', label: 'Burned' },
  { key: 'flagged', label: 'Flagged' },
]

const INPUT_CLASS =
  'bg-surface-3 border-border rounded-md focus-visible:ring-brand text-sm'

export function DashboardView() {
  const user = useAppStore((s) => s.user)
  const goLogin = useAppStore((s) => s.goLogin)

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 sm:px-6">
        <Reveal
          variant={fadeUp}
          className="mx-auto mt-12 max-w-md"
        >
          <div className="surface glow-brand rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Log in required
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to be logged in to view your dashboard.
            </p>
            <Button
              onClick={goLogin}
              className="btn-shine mt-5 gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <LogIn className="h-4 w-4" /> Go to login
            </Button>
          </div>
        </Reveal>
      </div>
    )
  }

  return <DashboardInner />
}

function DashboardInner() {
  const user = useAppStore((s) => s.user)!
  const setUser = useAppStore((s) => s.setUser)
  const goHome = useAppStore((s) => s.goHome)

  const [pastes, setPastes] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [editing, setEditing] = useState<SafePaste | null>(null)
  const [deleting, setDeleting] = useState<SafePaste | null>(null)

  const name = user.displayName || user.email.split('@')[0]

  async function fetchPastes() {
    setLoading(true)
    try {
      const rows = await api.listPastes({ scope: 'own', pageSize: 50 })
      setPastes(rows)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load pastes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPastes()
  }, [])

  const filtered = useMemo(() => {
    return pastes.filter((p) => {
      if (filter === 'active')
        return !p.isExpired && !p.isBurned && !p.isFlagged
      if (filter === 'expired') return p.isExpired
      if (filter === 'burned') return p.isBurned
      if (filter === 'flagged') return p.isFlagged
      return true
    })
  }, [pastes, filter])

  async function onDelete(p: SafePaste) {
    try {
      await api.deletePaste(p.id)
      setPastes((cur) => cur.filter((x) => x.id !== p.id))
      toast.success('Paste deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 sm:px-6">
      {/* Header */}
      <Reveal variant={fadeUp} className="mb-8">
        <p className="font-mono text-xs text-brand">
          <span className="text-muted-foreground">{'>'}</span> ~/dashboard
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome, <span className="font-medium text-foreground">{name}</span>
        </p>
      </Reveal>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Profile */}
        <div className="lg:col-span-1">
          <ProfileCard
            user={user}
            setUser={setUser}
            goHome={goHome}
          />
        </div>

        {/* My pastes */}
        <div className="lg:col-span-2">
          <Reveal variant={fadeUp} delay={0.05}>
            <div className="surface rounded-2xl p-5">
              {/* Header row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    My Pastes
                  </h2>
                  <AnimatedNumber
                    value={pastes.length}
                    className="font-mono text-sm text-brand"
                  />
                </div>
                <Button
                  onClick={goHome}
                  className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
                  size="sm"
                >
                  <Plus className="h-4 w-4" /> New paste
                </Button>
              </div>

              {/* Filter chips */}
              <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`font-mono rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      filter === f.key
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              {loading ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="shimmer bg-surface h-40 rounded-xl"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="surface-2 rounded-xl p-12 text-center">
                  <p className="text-sm text-muted-foreground">No pastes yet</p>
                  <Button
                    onClick={goHome}
                    className="btn-shine mt-4 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" /> Create your first paste
                  </Button>
                </div>
              ) : (
                <StaggerGroup stagger={0.05} className="space-y-4">
                  {filtered.map((p) => (
                    <Reveal key={p.id} variant={fadeUp}>
                      <PasteCard paste={p} />
                      <div className="mt-2 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(p)}
                          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(p)}
                          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </Reveal>
                  ))}
                </StaggerGroup>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* Edit dialog */}
      <EditPasteDialog
        paste={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setPastes((cur) =>
            cur.map((p) => (p.id === updated.id ? updated : p)),
          )
          setEditing(null)
        }}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paste?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-mono text-foreground">
                {deleting?.slug}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && onDelete(deleting)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------------- Profile card ---------------- */

function ProfileCard({
  user,
  setUser,
  goHome,
}: {
  user: SafeUser
  setUser: (u: SafeUser | null) => void
  goHome: () => void
}) {
  const name = user.displayName || user.email.split('@')[0]
  const initials = name.slice(0, 2).toUpperCase()
  const [showKey, setShowKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function regenerate() {
    setRegenerating(true)
    try {
      const rows = await api.updateProfile({ regenerateApiKey: true })
      const u = rows[0] as SafeUser | undefined
      if (u) {
        setUser(u)
        toast.success('API key regenerated')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to regenerate.')
    } finally {
      setRegenerating(false)
    }
  }

  function maskKey(k: string | null) {
    if (!k) return '—'
    if (showKey) return k
    if (k.length <= 8) return '••••••••'
    return `${k.slice(0, 8)}••••••••`
  }

  return (
    <Reveal variant={scaleIn}>
      <div className="surface rounded-2xl p-5">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 font-semibold text-brand-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                  <Shield className="h-2.5 w-2.5" /> admin
                </span>
              )}
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>

        {/* API key */}
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            API key
          </p>
          <div className="mt-1.5 surface-3 rounded-md p-2">
            <div className="flex items-center gap-1">
              <code className="flex-1 truncate font-mono text-xs text-foreground">
                {maskKey(user.apiKey)}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-brand"
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-brand disabled:opacity-50"
                title="Regenerate"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsibles */}
        <div className="mt-5 space-y-2">
          <EditProfileCollapsible user={user} setUser={setUser} />
          <ChangePasswordCollapsible />
          <DeleteAccountCollapsible setUser={setUser} goHome={goHome} />
        </div>
      </div>
    </Reveal>
  )
}

function StatusBadge({ status }: { status: SafeUser['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        <Check className="h-2.5 w-2.5" /> active
      </span>
    )
  if (status === 'suspended')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
        suspended
      </span>
    )
  if (status === 'banned')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        banned
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      pending
    </span>
  )
}

function CollapsibleRow({
  label,
  children,
  danger,
}: {
  label: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <Collapsible className="surface-2 rounded-md">
      <CollapsibleTrigger
        className={`flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          danger
            ? 'text-destructive hover:bg-destructive/5'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0">
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function EditProfileCollapsible({
  user,
  setUser,
}: {
  user: SafeUser
  setUser: (u: SafeUser | null) => void
}) {
  const [displayName, setDisplayName] = useState(user.displayName || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const rows = await api.updateProfile({ displayName })
      const u = rows[0] as SafeUser | undefined
      if (u) {
        setUser(u)
        toast.success('Profile updated')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleRow label="Edit profile">
      <div className="space-y-2">
        <Label
          htmlFor="display-name"
          className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          Display name
        </Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Your name"
        />
        <Button
          onClick={save}
          disabled={saving}
          className="btn-shine w-full bg-brand text-brand-foreground hover:bg-brand/90"
          size="sm"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>
    </CollapsibleRow>
  )
}

function ChangePasswordCollapsible() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (next.length > 0 && next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      const rows = await api.updateProfile({
        currentPassword: current,
        newPassword: next,
      })
      const u = rows[0] as SafeUser | undefined
      if (u) {
        toast.success('Password changed')
        setCurrent('')
        setNext('')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleRow label="Change password">
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="cur-pw"
            className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            Current password
          </Label>
          <Input
            id="cur-pw"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={INPUT_CLASS}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="new-pw"
            className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            New password
          </Label>
          <Input
            id="new-pw"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={INPUT_CLASS}
            placeholder="At least 8 characters"
          />
        </div>
        <Button
          onClick={save}
          disabled={saving || !current || !next}
          className="btn-shine w-full bg-brand text-brand-foreground hover:bg-brand/90"
          size="sm"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>
    </CollapsibleRow>
  )
}

function DeleteAccountCollapsible({
  setUser,
  goHome,
}: {
  setUser: (u: SafeUser | null) => void
  goHome: () => void
}) {
  const [current, setCurrent] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      await api.deleteAccount(current)
      toast.success('Account deleted')
      setUser(null)
      goHome()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <CollapsibleRow label="Delete account" danger>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Permanently delete your account and all your pastes. This cannot be
          undone.
        </p>
        <div className="space-y-1.5">
          <Label
            htmlFor="del-pw"
            className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            Current password
          </Label>
          <Input
            id="del-pw"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={INPUT_CLASS}
            placeholder="••••••••"
          />
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={!current}
          variant="outline"
          className="mt-2 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          size="sm"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete account
        </Button>
      </CollapsibleRow>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and all your pastes. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Delete forever'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ---------------- Edit paste dialog ---------------- */

function EditPasteDialog({
  paste,
  onClose,
  onSaved,
}: {
  paste: SafePaste | null
  onClose: () => void
  onSaved: (updated: SafePaste) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [expiry, setExpiry] = useState('never')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (paste) {
      setTitle(paste.title || '')
      setDescription(paste.description || '')
      setTags((paste.tags || []).join(', '))
      setVisibility(paste.visibility)
      setExpiry('never')
    }
  }, [paste])

  async function save() {
    if (!paste) return
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {
        title: title || null,
        description: description || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .join(','),
        visibility,
      }
      if (expiry !== 'never') patch.expiryPreset = expiry
      const rows = await api.updatePaste(paste.id, patch)
      const updated = rows[0] as SafePaste | undefined
      if (updated) {
        toast.success('Paste updated')
        onSaved(updated)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!paste} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit paste</DialogTitle>
          <DialogDescription>
            Update metadata for{' '}
            <span className="font-mono text-foreground">{paste?.slug}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-title"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Title
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Untitled"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-desc"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Description
            </Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Short description"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-tags"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Tags (comma separated)
            </Label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={INPUT_CLASS}
              placeholder="rust, api, demo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Visibility
              </Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Extend expiry
              </Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
