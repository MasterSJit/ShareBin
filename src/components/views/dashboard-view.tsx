'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Shield,
  Lock,
  ChevronDown,
  LogIn,
  AlertTriangle,
  Copy,
  Check,
  Crown,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { PasteCard } from '@/components/paste-card'
import { LANGUAGES, EXPIRY_OPTIONS, formatDate, formatRelativeTime } from '@/lib/ui-utils'
import {
  Reveal,
  StaggerGroup,
  AnimatedNumber,
  fadeUp,
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

export function DashboardView() {
  const { user, goLogin } = useAppStore()

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Reveal variant={fadeUp} className="mx-auto mt-12 max-w-md">
          <div className="glass-strong gradient-border rounded-2xl p-8 text-center glow-brand">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
              <Lock className="h-7 w-7 text-brand-foreground" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Log in required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to be logged in to view your dashboard.
            </p>
            <Button
              onClick={goLogin}
              className="btn-shine mt-5 gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30"
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
  const { user, setUser, goHome } = useAppStore()
  const [pastes, setPastes] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [editing, setEditing] = useState<SafePaste | null>(null)
  const [deleting, setDeleting] = useState<SafePaste | null>(null)

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
      if (filter === 'active') return !p.isExpired && !p.isBurned && !p.isFlagged
      if (filter === 'expired') return p.isExpired
      if (filter === 'burned') return p.isBurned
      if (filter === 'flagged') return p.isFlagged
      return true
    })
  }, [pastes, filter])

  const counts = useMemo(
    () => ({
      all: pastes.length,
      active: pastes.filter((p) => !p.isExpired && !p.isBurned && !p.isFlagged).length,
      expired: pastes.filter((p) => p.isExpired).length,
      burned: pastes.filter((p) => p.isBurned).length,
      flagged: pastes.filter((p) => p.isFlagged).length,
    }),
    [pastes],
  )

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

  if (!user) return null

  const name = user.displayName || user.email.split('@')[0]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Header */}
      <Reveal variant={fadeUp} className="mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-12 w-12 ring-2 ring-brand/40 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-2 text-brand-foreground">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient">My Dashboard</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{name}</span>
            </p>
          </div>
        </div>
      </Reveal>

      <div className="lg:grid lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1">
          <Reveal variant={fadeUp}>
            <ProfileCard user={user} onUpdate={setUser} />
          </Reveal>
        </div>

        {/* My Pastes */}
        <section className="lg:col-span-2">
          <Reveal variant={fadeUp} delay={0.05}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
                My Pastes
                <span className="text-2xl font-bold text-brand">
                  <AnimatedNumber value={pastes.length} />
                </span>
              </h2>
              <Button
                onClick={goHome}
                size="sm"
                className="btn-shine gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
              >
                <Plus className="h-4 w-4" /> New paste
              </Button>
            </div>
          </Reveal>

          {/* Filter chips */}
          <Reveal variant={fadeUp} delay={0.1} className="mb-5">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const isActive = filter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={
                      'glass rounded-full px-3 py-1.5 text-xs font-medium transition-all ' +
                      (isActive
                        ? 'bg-brand/15 text-brand shadow-sm shadow-brand/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-brand/5')
                    }
                  >
                    {f.label}{' '}
                    <span className={isActive ? 'text-brand/80' : 'text-muted-foreground/70'}>
                      {counts[f.key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </Reveal>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="shimmer rounded-xl border border-border/50 bg-muted/30 p-4"
                >
                  <Skeleton className="mb-2 h-5 w-2/3" />
                  <Skeleton className="mb-3 h-3 w-1/3" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Reveal variant={fadeUp}>
              <div className="glass rounded-2xl p-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
                  <Plus className="h-6 w-6 text-brand" />
                </div>
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t created any pastes yet.
                </p>
                <Button
                  onClick={goHome}
                  className="btn-shine mt-4 gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
                >
                  <Plus className="h-4 w-4" /> Create your first paste
                </Button>
              </div>
            </Reveal>
          ) : (
            <StaggerGroup stagger={0.05} className="space-y-4">
              {filtered.map((p) => (
                <motion.div key={p.id} variants={fadeUp}>
                  <PasteCard paste={p} />
                  <div className="mt-1.5 flex items-center justify-end gap-2 px-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs hover:border-brand/50 hover:text-brand"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
            </StaggerGroup>
          )}
        </section>
      </div>

      {editing && (
        <EditPasteDialog
          paste={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchPastes()
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paste?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.title || deleting?.slug}&quot; will be permanently removed. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

function ProfileCard({
  user,
  onUpdate,
}: {
  user: SafeUser
  onUpdate: (u: SafeUser) => void
}) {
  const [showKey, setShowKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Edit profile
  const [editOpen, setEditOpen] = useState(false)
  const [displayName, setDisplayName] = useState(user.displayName || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Change password
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Delete account
  const [delOpen, setDelOpen] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [deleting, setDeleting] = useState(false)

  const { setUser, goHome } = useAppStore()

  async function regenerate() {
    setRegenerating(true)
    try {
      const rows = await api.updateProfile({ regenerateApiKey: true })
      const u = rows[0]
      if (u) {
        onUpdate(u)
        toast.success('API key regenerated')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to regenerate key.')
    } finally {
      setRegenerating(false)
    }
  }

  function copyKey() {
    if (!user.apiKey) return
    navigator.clipboard.writeText(user.apiKey).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 1500)
    })
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const rows = await api.updateProfile({ displayName: displayName || undefined })
      const u = rows[0]
      if (u) {
        onUpdate(u)
        toast.success('Profile updated')
        setEditOpen(false)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (newPw.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSavingPw(true)
    try {
      const rows = await api.updateProfile({ currentPassword: currentPw, newPassword: newPw })
      const u = rows[0]
      if (u) {
        onUpdate(u)
        toast.success('Password changed')
        setPwOpen(false)
        setCurrentPw('')
        setNewPw('')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Password change failed.')
    } finally {
      setSavingPw(false)
    }
  }

  async function deleteAccount() {
    if (!delPw) {
      toast.error('Enter your current password.')
      return
    }
    setDeleting(true)
    try {
      await api.deleteAccount(delPw)
      toast.success('Account deleted')
      setUser(null)
      goHome()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  const maskedKey = user.apiKey
    ? showKey
      ? user.apiKey
      : user.apiKey.slice(0, 6) + '••••••••••••••••'
    : '—'

  return (
    <div className="glass-strong gradient-border rounded-2xl p-5 glow-brand-hover">
      {/* Profile head */}
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-gradient-to-br from-brand to-brand-2 p-[2px]">
          <Avatar className="h-12 w-12 border-2 border-background">
            <AvatarFallback className="bg-background text-sm font-semibold text-brand">
              {(user.displayName || user.email).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {user.displayName || 'Unnamed user'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {user.role === 'admin' ? (
          <Badge className="gap-1 bg-brand/15 text-brand hover:bg-brand/20">
            <Crown className="h-3 w-3" /> admin
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" /> user
          </Badge>
        )}
        <Badge
          variant="outline"
          className={
            user.status === 'active'
              ? 'border-brand/40 text-brand'
              : user.status === 'banned'
                ? 'border-destructive/40 text-destructive'
                : 'border-amber-500/40 text-amber-500'
          }
        >
          {user.status.replace('_', ' ')}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          joined {formatRelativeTime(user.createdAt)}
        </Badge>
      </div>

      {/* API key */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> API key
          </Label>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:text-brand"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? 'Hide' : 'Show'}
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:text-brand"
              onClick={copyKey}
              disabled={!user.apiKey}
              title="Copy"
            >
              {copiedKey ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:text-brand"
              onClick={regenerate}
              disabled={regenerating}
              title="Regenerate"
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <code className="block w-full truncate rounded-md border border-border/50 bg-muted/40 px-2 py-1.5 font-mono text-xs">
          {maskedKey}
        </code>
      </div>

      <Separator className="my-4" />

      {/* Edit profile */}
      <StaggerGroup stagger={0.04} className="space-y-2">
        <motion.div variants={fadeUp}>
          <Collapsible open={editOpen} onOpenChange={setEditOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium transition-colors hover:bg-brand/5 hover:text-brand">
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </span>
              <ChevronDown
                className={
                  'h-4 w-4 transition-transform ' + (editOpen ? 'rotate-180' : '')
                }
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <Label htmlFor="dn" className="text-xs">Display name</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-brand"
              />
              <Button
                size="sm"
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
              >
                {savingProfile && <Loader2 className="h-3 w-3 animate-spin" />} Save
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>

        {/* Change password */}
        <motion.div variants={fadeUp}>
          <Collapsible open={pwOpen} onOpenChange={setPwOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium transition-colors hover:bg-brand/5 hover:text-brand">
              <span className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" /> Change password
              </span>
              <ChevronDown
                className={
                  'h-4 w-4 transition-transform ' + (pwOpen ? 'rotate-180' : '')
                }
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div>
                <Label htmlFor="cp" className="text-xs">Current password</Label>
                <Input
                  id="cp"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <div>
                <Label htmlFor="np" className="text-xs">New password</Label>
                <Input
                  id="np"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
              <Button
                size="sm"
                onClick={savePassword}
                disabled={savingPw}
                className="w-full gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
              >
                {savingPw && <Loader2 className="h-3 w-3 animate-spin" />} Update password
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      </StaggerGroup>

      <Separator className="my-4" />

      {/* Danger zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </div>
        <p className="text-xs text-muted-foreground">
          Permanently delete your account and all your pastes.
        </p>
        <Collapsible open={delOpen} onOpenChange={setDelOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full gap-1.5">
              <Trash2 className="h-3 w-3" /> Delete account
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <Label htmlFor="dpw" className="text-xs">Confirm with your password</Label>
            <Input
              id="dpw"
              type="password"
              value={delPw}
              onChange={(e) => setDelPw(e.target.value)}
              className="h-8 bg-muted/30 text-sm focus-visible:ring-2 focus-visible:ring-destructive"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full" disabled={!delPw}>
                  Confirm permanent deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-strong">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all associated pastes. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={deleteAccount}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Delete forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}

function EditPasteDialog({
  paste,
  onClose,
  onSaved,
}: {
  paste: SafePaste
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(paste.title || '')
  const [description, setDescription] = useState(paste.description || '')
  const [tags, setTags] = useState(paste.tags.join(', '))
  const [language, setLanguage] = useState(paste.language)
  const [visibility, setVisibility] = useState(paste.visibility)
  const [expiryPreset, setExpiryPreset] = useState('never')
  const [burnAfterRead, setBurnAfterRead] = useState(paste.burnAfterRead)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const patch: Record<string, unknown> = {
        title,
        description,
        tags,
        language,
        visibility,
        burnAfterRead,
      }
      if (expiryPreset !== 'never') patch.expiryPreset = expiryPreset
      await api.updatePaste(paste.id, patch)
      toast.success('Paste updated')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong sm:max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        <DialogHeader>
          <DialogTitle className="text-gradient">Edit paste</DialogTitle>
          <DialogDescription>
            <code className="font-mono text-xs">/{paste.slug}</code> · created{' '}
            {formatDate(paste.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ep-title" className="text-xs">Title</Label>
            <Input
              id="ep-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          <div>
            <Label htmlFor="ep-desc" className="text-xs">Description</Label>
            <Textarea
              id="ep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          <div>
            <Label htmlFor="ep-tags" className="text-xs">Tags (comma-separated)</Label>
            <Input
              id="ep-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, api, draft"
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {LANGUAGES.map((l, i) => (
                    <SelectItem key={`${l.value}-${i}`} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="w-full bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Expiry</Label>
            <Select value={expiryPreset} onValueChange={setExpiryPreset}>
              <SelectTrigger className="w-full bg-muted/30">
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
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">Burn after read</p>
              <p className="text-xs text-muted-foreground">Delete the paste once it&apos;s viewed.</p>
            </div>
            <Switch checked={burnAfterRead} onCheckedChange={setBurnAfterRead} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="btn-shine gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
