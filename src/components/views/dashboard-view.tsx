'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  ChevronRight,
  LogIn,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { PasteCard } from '@/components/paste-card'
import { LANGUAGES, EXPIRY_OPTIONS, formatDate, formatRelativeTime } from '@/lib/ui-utils'
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Log in required</CardTitle>
            <CardDescription>You need to be logged in to view your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={goLogin} className="gap-2">
              <LogIn className="h-4 w-4" /> Go to login
            </Button>
          </CardContent>
        </Card>
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

  const counts = useMemo(() => {
    return {
      all: pastes.length,
      active: pastes.filter((p) => !p.isExpired && !p.isBurned && !p.isFlagged).length,
      expired: pastes.filter((p) => p.isExpired).length,
      burned: pastes.filter((p) => p.isBurned).length,
      flagged: pastes.filter((p) => p.isFlagged).length,
    }
  }, [pastes])

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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome, {user.displayName || user.email}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <ProfileCard user={user} onUpdate={setUser} />

        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">My Pastes ({pastes.length})</h2>
            <Button onClick={goHome} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New paste
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  'rounded-full border px-3 py-1 text-xs transition ' +
                  (filter === f.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')
                }
              >
                {f.label} ({counts[f.key]})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="mb-3">You haven&apos;t created any pastes yet.</p>
                <Button onClick={goHome} variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Create your first paste
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div key={p.id} className="relative">
                  <PasteCard paste={p} />
                  <div className="absolute right-3 top-3 flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(p)
                      }}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(p)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
        <AlertDialogContent>
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
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {(user.displayName || user.email).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {user.displayName || 'Unnamed user'}
            </CardTitle>
            <CardDescription className="truncate text-xs">{user.email}</CardDescription>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" /> {user.role}
          </Badge>
          <Badge variant={user.status === 'active' ? 'default' : 'outline'}>{user.status}</Badge>
          <Badge variant="outline" className="text-[10px]">
            joined {formatRelativeTime(user.createdAt)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> API key
            </Label>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
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
          <code className="block w-full truncate rounded border bg-muted/40 px-2 py-1.5 font-mono text-xs">
            {maskedKey}
          </code>
        </div>

        <Separator />

        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
            <span className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </span>
            {editOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <Label htmlFor="dn" className="text-xs">Display name</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={saveProfile} disabled={savingProfile} className="w-full">
              {savingProfile && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <Collapsible open={pwOpen} onOpenChange={setPwOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
            <span className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" /> Change password
            </span>
            {pwOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <div>
              <Label htmlFor="cp" className="text-xs">Current password</Label>
              <Input
                id="cp"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="np" className="text-xs">New password</Label>
              <Input
                id="np"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={savePassword} disabled={savingPw} className="w-full">
              {savingPw && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Update password
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </div>
          <p className="text-xs text-muted-foreground">
            Permanently delete your account and all your pastes.
          </p>
          <Collapsible open={delOpen} onOpenChange={setDelOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="h-3 w-3 mr-1" /> Delete account
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              <Label htmlFor="dpw" className="text-xs">Confirm with your password</Label>
              <Input
                id="dpw"
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                className="h-8 text-sm"
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full" disabled={!delPw}>
                    Confirm permanent deletion
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
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
      </CardContent>
    </Card>
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        <DialogHeader>
          <DialogTitle>Edit paste</DialogTitle>
          <DialogDescription>
            <code className="font-mono text-xs">/{paste.slug}</code> · created{' '}
            {formatDate(paste.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ep-title" className="text-xs">Title</Label>
            <Input id="ep-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ep-desc" className="text-xs">Description</Label>
            <Textarea
              id="ep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="ep-tags" className="text-xs">Tags (comma-separated)</Label>
            <Input
              id="ep-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, api, draft"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
          <div className="flex items-center justify-between rounded-md border p-3">
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
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
