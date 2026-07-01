'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Shield,
  ShieldAlert,
  Users as UsersIcon,
  FileText,
  HardDrive,
  Flag,
  Flame,
  Search,
  MoreHorizontal,
  CheckCircle2,
  Ban,
  Pause,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Crown,
  Loader2,
  Lock,
  Save,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatBytes, formatRelativeTime, formatDate, EXPIRY_OPTIONS } from '@/lib/ui-utils'
import type { SafePaste, SafeUser, SafeAuditLog } from '@/lib/types'

type Analytics = {
  totalUsers: number
  totalPastes: number
  totalFiles: number
  totalActivePastes: number
  flaggedCount: number
  burnedCount: number
  totalViews: number
  storageUsedBytes: number
  topLanguages: { language: string; count: number }[]
  traffic: { date: string; count: number }[]
}

type UserRow = SafeUser & { pasteCount?: number }

const SCROLLBAR_CLASS =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30'

export function AdminView() {
  const { user, goHome } = useAppStore()

  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Admin only</CardTitle>
            <CardDescription>
              You don&apos;t have permission to access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={goHome} variant="outline">
              Back to home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AdminInner />
}

function AdminInner() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      <header className="mb-6 flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, content, and site settings.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-row gap-4">
        <TabsList className="lg:flex-col lg:h-fit lg:w-52 lg:justify-start lg:items-stretch">
          <TabsTrigger value="overview" className="justify-start gap-2">
            <Activity className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="justify-start gap-2">
            <UsersIcon className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="content" className="justify-start gap-2">
            <FileText className="h-4 w-4" /> Content
          </TabsTrigger>
          <TabsTrigger value="settings" className="justify-start gap-2">
            <HardDrive className="h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="audit" className="justify-start gap-2">
            <ShieldAlert className="h-4 w-4" /> Audit Log
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersTab />
          </TabsContent>
          <TabsContent value="content" className="mt-0">
            <ContentTab />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <SettingsTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ---------------- Overview ----------------

function OverviewTab() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.admin
      .analytics()
      .then((rows) => {
        if (active && rows[0]) setData(rows[0])
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load analytics.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
        <Skeleton className="h-64 rounded-xl sm:col-span-2 lg:col-span-4" />
      </div>
    )
  }

  const traffic = data.traffic.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total users" value={data.totalUsers.toLocaleString()} icon={<UsersIcon className="h-4 w-4" />} />
        <KpiCard label="Active pastes" value={data.totalActivePastes.toLocaleString()} icon={<FileText className="h-4 w-4" />} />
        <KpiCard label="Total files" value={data.totalFiles.toLocaleString()} icon={<HardDrive className="h-4 w-4" />} />
        <KpiCard label="Storage used" value={formatBytes(data.storageUsedBytes)} icon={<HardDrive className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Flagged content" value={data.flaggedCount.toLocaleString()} icon={<Flag className="h-4 w-4" />} variant="warn" />
        <KpiCard label="Burned pastes" value={data.burnedCount.toLocaleString()} icon={<Flame className="h-4 w-4" />} />
        <KpiCard label="Total pastes" value={data.totalPastes.toLocaleString()} icon={<FileText className="h-4 w-4" />} />
        <KpiCard label="Total views" value={data.totalViews.toLocaleString()} icon={<Activity className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Paste creation — last 14 days</CardTitle>
            <CardDescription>Daily new pastes across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={traffic} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top languages</CardTitle>
            <CardDescription>By paste count.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topLanguages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.topLanguages.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      type="category"
                      dataKey="language"
                      width={80}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  variant = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  variant?: 'default' | 'warn'
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={variant === 'warn' ? 'text-destructive' : 'text-muted-foreground'}>
            {icon}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

// ---------------- Users ----------------

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
  { value: 'pending_verification', label: 'Pending verification' },
]

function UsersTab() {
  const me = useAppStore((s) => s.user)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    try {
      const data = await api.admin.listUsers(q || undefined, status === 'all' ? undefined : status)
      setRows(data)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchUsers, 250)
    return () => clearTimeout(t)
  }, [q, status])

  async function update(id: string, patch: Parameters<typeof api.admin.updateUser>[1]) {
    if (me && id === me.id) {
      const risky =
        patch.status === 'banned' ||
        patch.status === 'suspended' ||
        patch.role === 'user'
      if (risky) {
        toast.error("You can't modify your own role or status.")
        return
      }
    }
    try {
      await api.admin.updateUser(id, patch)
      toast.success('User updated')
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    if (me && deleteTarget.id === me.id) {
      toast.error("You can't delete your own account from here.")
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await api.admin.deleteUser(deleteTarget.id)
      toast.success('User deleted')
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users</CardTitle>
        <CardDescription>{rows.length} user(s) match the current filter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={`max-h-[60vh] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pastes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {(u.displayName || u.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.displayName || 'Unnamed'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.role === 'admin' ? (
                        <Badge variant="default" className="gap-1">
                          <Crown className="h-3 w-3" /> admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">user</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {u.pasteCount ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {u.status !== 'active' && (
                            <DropdownMenuItem onClick={() => update(u.id, { status: 'active', verify: true })}>
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Verify / activate
                            </DropdownMenuItem>
                          )}
                          {u.status !== 'suspended' && (
                            <DropdownMenuItem onClick={() => update(u.id, { status: 'suspended' })}>
                              <Pause className="mr-2 h-3.5 w-3.5" /> Suspend
                            </DropdownMenuItem>
                          )}
                          {u.status !== 'banned' && (
                            <DropdownMenuItem onClick={() => update(u.id, { status: 'banned' })}>
                              <Ban className="mr-2 h-3.5 w-3.5" /> Ban
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {u.role !== 'admin' ? (
                            <DropdownMenuItem onClick={() => update(u.id, { role: 'admin' })}>
                              <ArrowUpCircle className="mr-2 h-3.5 w-3.5" /> Make admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => update(u.id, { role: 'user' })}>
                              <ArrowDownCircle className="mr-2 h-3.5 w-3.5" /> Demote to user
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.displayName || deleteTarget?.email}&quot; will be permanently
              deleted along with their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function StatusBadge({ status }: { status: SafeUser['status'] }) {
  const map: Record<SafeUser['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    pending_verification: 'outline',
    suspended: 'secondary',
    banned: 'destructive',
  }
  return <Badge variant={map[status]}>{status.replace('_', ' ')}</Badge>
}

// ---------------- Content ----------------

function ContentTab() {
  const [q, setQ] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [expiredOnly, setExpiredOnly] = useState(false)
  const [rows, setRows] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SafePaste | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchPastes() {
    setLoading(true)
    try {
      const data = await api.admin.listPastes({
        q: q || undefined,
        flagged: flaggedOnly || undefined,
        expired: expiredOnly || undefined,
      })
      setRows(data)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load content.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchPastes, 250)
    return () => clearTimeout(t)
  }, [q, flaggedOnly, expiredOnly])

  async function update(id: string, patch: Parameters<typeof api.admin.updatePaste>[1]) {
    try {
      await api.admin.updatePaste(id, patch)
      toast.success('Paste updated')
      fetchPastes()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.admin.deletePaste(deleteTarget.id)
      toast.success('Paste deleted')
      fetchPastes()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content moderation</CardTitle>
        <CardDescription>{rows.length} paste(s) match the current filter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or slug…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <label className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 cursor-pointer">
            <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} />
            <Flag className="h-3.5 w-3.5" /> Flagged only
          </label>
          <label className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 cursor-pointer">
            <Switch checked={expiredOnly} onCheckedChange={setExpiredOnly} />
            <Flame className="h-3.5 w-3.5" /> Expired only
          </label>
        </div>

        <div className={`max-h-[60vh] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No content found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="min-w-0 max-w-[220px]">
                        <p className="text-sm font-medium truncate">
                          {p.title || (p.contentType === 'file' ? p.originalFileName : `/${p.slug}`)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate font-mono">/{p.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.contentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{p.language}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.viewCount}</TableCell>
                    <TableCell>
                      <PasteStatusBadge paste={p} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.ownerName || 'guest'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => update(p.id, { isFlagged: !p.isFlagged })}>
                            <Flag className="mr-2 h-3.5 w-3.5" />
                            {p.isFlagged ? 'Unflag' : 'Flag'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => update(p.id, { forceExpire: true })}
                            disabled={p.isExpired}
                          >
                            <Flame className="mr-2 h-3.5 w-3.5" /> Force expire
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                          {(['public', 'unlisted', 'private'] as const).map((v) => (
                            <DropdownMenuItem
                              key={v}
                              onClick={() => update(p.id, { visibility: v })}
                              disabled={p.visibility === v}
                            >
                              <span className="mr-2 capitalize">{v}</span>
                              {p.visibility === v && <CheckCircle2 className="h-3 w-3" />}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paste?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title || deleteTarget?.slug}&quot; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function PasteStatusBadge({ paste }: { paste: SafePaste }) {
  if (paste.isFlagged) return <Badge variant="destructive">flagged</Badge>
  if (paste.isBurned) return <Badge variant="secondary">burned</Badge>
  if (paste.isExpired) return <Badge variant="outline">expired</Badge>
  return <Badge variant="default">active</Badge>
}

// ---------------- Settings ----------------

type Settings = {
  siteName?: string
  tagline?: string
  defaultExpiry?: string
  maxFileSizeBytes?: number
  allowedFileTypes?: string
  storageDriver?: string
  guestPostingEnabled?: boolean
  sitemapEnabled?: boolean
  metaTitleTemplate?: string
  metaDescriptionTemplate?: string
  robotsTxt?: string
  [k: string]: unknown
}

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    api.admin
      .getSettings()
      .then((rows) => {
        if (active && rows[0]) setSettings(rows[0] as Settings)
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      const rows = await api.admin.updateSettings(settings as Record<string, unknown>)
      if (rows[0]) setSettings(rows[0] as Settings)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  if (loading || !settings) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  // maxFileSizeBytes stored as bytes; UI shows MB
  const sizeMB = settings.maxFileSizeBytes ? Math.round(settings.maxFileSizeBytes / (1024 * 1024)) : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Site settings</CardTitle>
          <CardDescription>Configuration applies platform-wide.</CardDescription>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name">
            <Input
              value={settings.siteName || ''}
              onChange={(e) => set('siteName', e.target.value)}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={settings.tagline || ''}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default expiry">
            <Select
              value={settings.defaultExpiry || 'never'}
              onValueChange={(v) => set('defaultExpiry', v)}
            >
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
          </Field>
          <Field label="Max file size (MB)">
            <Input
              type="number"
              min={1}
              value={sizeMB}
              onChange={(e) => set('maxFileSizeBytes', Math.max(0, Number(e.target.value)) * 1024 * 1024)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Allowed file types (comma-separated extensions)">
            <Input
              value={settings.allowedFileTypes || ''}
              onChange={(e) => set('allowedFileTypes', e.target.value)}
              placeholder=".png, .jpg, .pdf"
            />
          </Field>
          <Field label="Storage driver">
            <Select
              value={settings.storageDriver || 'local'}
              onValueChange={(v) => set('storageDriver', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local filesystem</SelectItem>
                <SelectItem value="s3">S3-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleRow
            label="Guest posting enabled"
            description="Allow non-logged-in users to create pastes."
            checked={!!settings.guestPostingEnabled}
            onCheckedChange={(v) => set('guestPostingEnabled', v)}
          />
          <ToggleRow
            label="Sitemap enabled"
            description="Generate /sitemap.xml for public pastes."
            checked={!!settings.sitemapEnabled}
            onCheckedChange={(v) => set('sitemapEnabled', v)}
          />
        </div>

        <Separator />

        <Field label="Meta title template">
          <Input
            value={settings.metaTitleTemplate || ''}
            onChange={(e) => set('metaTitleTemplate', e.target.value)}
            placeholder="%s · PasteShare"
          />
        </Field>
        <Field label="Meta description template">
          <Textarea
            rows={2}
            value={settings.metaDescriptionTemplate || ''}
            onChange={(e) => set('metaDescriptionTemplate', e.target.value)}
          />
        </Field>
        <Field label="robots.txt">
          <Textarea
            rows={5}
            value={settings.robotsTxt || ''}
            onChange={(e) => set('robotsTxt', e.target.value)}
            className="font-mono text-xs"
          />
        </Field>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// ---------------- Audit ----------------

function AuditTab() {
  const [rows, setRows] = useState<SafeAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.admin
      .listAudit(100)
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load audit log.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit log</CardTitle>
        <CardDescription>Last {rows.length} admin actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`max-h-[60vh] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => {
                  const isOpen = expanded === a.id
                  let metaStr: string
                  try {
                    metaStr = JSON.stringify(a.metadata, null, 2)
                  } catch {
                    metaStr = String(a.metadata)
                  }
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">{a.adminEmail || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {a.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{a.targetType}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {a.targetId ? a.targetId.slice(0, 8) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {metaStr && metaStr !== '{}' && metaStr !== 'null' ? (
                          <div>
                            <button
                              onClick={() => setExpanded(isOpen ? null : a.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <span className="truncate font-mono">
                                {isOpen ? '' : metaStr.slice(0, 60)}
                              </span>
                            </button>
                            {isOpen && (
                              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[10px] font-mono whitespace-pre-wrap break-all">
                                {metaStr}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
