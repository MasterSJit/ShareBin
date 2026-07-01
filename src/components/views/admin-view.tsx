'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  Eye,
  Settings as SettingsIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatBytes, formatRelativeTime, formatDate, EXPIRY_OPTIONS } from '@/lib/ui-utils'
import {
  Reveal,
  StaggerGroup,
  AnimatedNumber,
  fadeUp,
  scaleIn,
} from '@/components/motion-helpers'
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

// Brand chart colors (no indigo/blue)
const C = {
  brand: 'oklch(0.7 0.18 162)',
  brand2: 'oklch(0.65 0.22 300)',
  amber: 'oklch(0.75 0.2 50)',
  rose: 'oklch(0.68 0.22 22)',
  fuchsia: 'oklch(0.7 0.2 330)',
}

export function AdminView() {
  const { user, goHome } = useAppStore()

  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Reveal variant={fadeUp} className="mx-auto mt-12 max-w-md">
          <div className="glass-strong gradient-border rounded-2xl p-8 text-center glow-brand">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Lock className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Admin only</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You don&apos;t have permission to access the admin panel.
            </p>
            <Button
              onClick={goHome}
              className="btn-shine mt-5 gap-2 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30"
            >
              Back to home
            </Button>
          </div>
        </Reveal>
      </div>
    )
  }

  return <AdminInner />
}

function AdminInner() {
  const [tab, setTab] = useState('overview')

  const TABS: { value: string; label: string; icon: ReactNode }[] = [
    { value: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
    { value: 'users', label: 'Users', icon: <UsersIcon className="h-4 w-4" /> },
    { value: 'content', label: 'Content', icon: <FileText className="h-4 w-4" /> },
    { value: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
    { value: 'audit', label: 'Audit Log', icon: <ShieldAlert className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Header */}
      <Reveal variant={fadeUp} className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
          <Shield className="h-6 w-6 text-brand-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Admin Panel</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage users, content, and site settings.
          </p>
        </div>
      </Reveal>

      <Tabs
        value={tab}
        onValueChange={setTab}
        orientation="vertical"
        className="flex flex-col gap-4 lg:flex-row"
      >
        <Reveal variant={fadeUp} delay={0.05}>
          <TabsList className="glass grid h-fit w-full grid-cols-5 gap-1 rounded-xl p-1.5 lg:flex lg:w-56 lg:flex-col lg:grid-cols-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="justify-start gap-2 rounded-lg px-3 py-2 text-xs transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-brand-2 data-[state=active]:text-brand-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-brand/20 lg:text-sm"
              >
                {t.icon}
                <span className="hidden sm:inline lg:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Reveal>

        <div className="min-w-0 flex-1">
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
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
        <Skeleton className="h-64 rounded-2xl sm:col-span-2 lg:col-span-4" />
      </div>
    )
  }

  const traffic = data.traffic.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }))

  const maxLang = data.topLanguages.reduce((m, l) => Math.max(m, l.count), 1)

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <StaggerGroup stagger={0.08} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal variants={scaleIn}>
          <KpiCard
            label="Total users"
            value={data.totalUsers}
            icon={<UsersIcon className="h-5 w-5" />}
            gradient="from-brand to-brand-2"
          />
        </Reveal>
        <Reveal variants={scaleIn}>
          <KpiCard
            label="Active pastes"
            value={data.totalActivePastes}
            icon={<FileText className="h-5 w-5" />}
            gradient="from-brand-2 to-fuchsia-500"
          />
        </Reveal>
        <Reveal variants={scaleIn}>
          <KpiCard
            label="Total files"
            value={data.totalFiles}
            icon={<HardDrive className="h-5 w-5" />}
            gradient="from-amber-500 to-brand"
          />
        </Reveal>
        <Reveal variants={scaleIn}>
          <KpiCard
            label="Storage used"
            value={data.storageUsedBytes}
            format={(n) => formatBytes(n)}
            icon={<HardDrive className="h-5 w-5" />}
            gradient="from-rose-500 to-brand-2"
          />
        </Reveal>
      </StaggerGroup>

      {/* Secondary stat cards */}
      <StaggerGroup stagger={0.06} className="grid gap-4 sm:grid-cols-2">
        <Reveal variants={scaleIn}>
          <div className="glass lift glow-brand-hover flex items-center gap-4 rounded-2xl p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">
                <AnimatedNumber value={data.flaggedCount} />
              </p>
              <p className="text-xs text-muted-foreground">Flagged content</p>
            </div>
          </div>
        </Reveal>
        <Reveal variants={scaleIn}>
          <div className="glass lift glow-brand-hover flex items-center gap-4 rounded-2xl p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">
                <AnimatedNumber value={data.burnedCount} />
              </p>
              <p className="text-xs text-muted-foreground">Burned pastes</p>
            </div>
          </div>
        </Reveal>
      </StaggerGroup>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal variant={fadeUp} className="lg:col-span-2">
          <div className="glass rounded-2xl p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h3 className="text-base font-semibold">Paste creation — last 14 days</h3>
                <p className="text-xs text-muted-foreground">Daily new pastes across the platform.</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-brand" /> daily count
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={traffic} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.brand} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<GlassTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={C.brand}
                    strokeWidth={2.5}
                    fill="url(#trafficFill)"
                    dot={false}
                    activeDot={{ r: 5, fill: C.brand, stroke: 'white', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal variant={fadeUp} delay={0.05}>
          <div className="glass h-full rounded-2xl p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Top languages</h3>
              <p className="text-xs text-muted-foreground">By paste count.</p>
            </div>
            {data.topLanguages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data.topLanguages.slice(0, 8).map((l, i) => (
                  <div key={l.language} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">{l.language}</span>
                      <span className="font-semibold">{l.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(l.count / maxLang) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  gradient,
  format,
}: {
  label: string
  value: number
  icon: ReactNode
  gradient: string
  format?: (n: number) => string
}) {
  return (
    <div className="glass lift glow-brand-hover rounded-2xl p-5">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}
      >
        {icon}
      </div>
      <p className="text-3xl font-bold tracking-tight">
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: string | number
  color?: string
}

function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="glass-strong rounded-lg border border-border/50 px-3 py-2 text-xs shadow-lg">
      {label !== undefined && label !== '' && (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
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
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-2 rounded-xl p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-muted/30 pl-9 focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px] bg-muted/30">
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

      <div className={`glass overflow-hidden rounded-2xl ${SCROLLBAR_CLASS}`}>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
              <TableRow className="border-border/50 hover:bg-transparent">
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
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                      className="border-b border-border/30 transition-colors hover:bg-brand/5"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-2 text-[10px] text-brand-foreground">
                              {(u.displayName || u.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {u.displayName || 'Unnamed'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <Badge className="gap-1 bg-brand/15 text-brand hover:bg-brand/20">
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-brand">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {u.status !== 'active' && (
                              <DropdownMenuItem
                                onClick={() => update(u.id, { status: 'active', verify: true })}
                              >
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
                    </motion.tr>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong">
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
              {deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatusBadge({ status }: { status: SafeUser['status'] }) {
  const map: Record<
    SafeUser['status'],
    { label: string; cls: string }
  > = {
    active: { label: 'active', cls: 'border-brand/40 text-brand' },
    pending_verification: {
      label: 'pending',
      cls: 'border-amber-500/40 text-amber-500',
    },
    suspended: {
      label: 'suspended',
      cls: 'border-amber-500/40 text-amber-500',
    },
    banned: { label: 'banned', cls: 'border-destructive/40 text-destructive' },
  }
  const v = map[status]
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>
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
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-xl p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-muted/30 pl-9 focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-xs">
          <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} />
          <Flag className="h-3.5 w-3.5 text-amber-500" /> Flagged only
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-xs">
          <Switch checked={expiredOnly} onCheckedChange={setExpiredOnly} />
          <Flame className="h-3.5 w-3.5 text-rose-500" /> Expired only
        </label>
      </div>

      <div className={`glass overflow-hidden rounded-2xl ${SCROLLBAR_CLASS}`}>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
              <TableRow className="border-border/50 hover:bg-transparent">
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
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    No content found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                      className="border-b border-border/30 transition-colors hover:bg-brand/5"
                    >
                      <TableCell>
                        <div className="min-w-0 max-w-[220px]">
                          <p className="truncate text-sm font-medium">
                            {p.title ||
                              (p.contentType === 'file' ? p.originalFileName : `/${p.slug}`)}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            /{p.slug}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {p.contentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.language}</TableCell>
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-brand">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => update(p.id, { isFlagged: !p.isFlagged })}
                            >
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
                    </motion.tr>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong">
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
              {deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PasteStatusBadge({ paste }: { paste: SafePaste }) {
  if (paste.isFlagged)
    return <Badge className="bg-rose-500/15 text-rose-500 hover:bg-rose-500/20">flagged</Badge>
  if (paste.isBurned)
    return <Badge variant="secondary">burned</Badge>
  if (paste.isExpired)
    return <Badge variant="outline">expired</Badge>
  return <Badge className="bg-brand/15 text-brand hover:bg-brand/20">active</Badge>
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
      <div className="glass-strong gradient-border rounded-2xl p-6">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  const sizeMB = settings.maxFileSizeBytes
    ? Math.round(settings.maxFileSizeBytes / (1024 * 1024))
    : 0

  return (
    <div className="glass-strong gradient-border rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            <span className="text-gradient">Site settings</span>
          </h2>
          <p className="text-xs text-muted-foreground">Configuration applies platform-wide.</p>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="btn-shine gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </Button>
      </div>

      <div className="space-y-6">
        {/* General */}
        <section className="space-y-3">
          <SectionTitle icon={<SettingsIcon className="h-3.5 w-3.5" />}>General</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name">
              <Input
                value={settings.siteName || ''}
                onChange={(e) => set('siteName', e.target.value)}
                className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
              />
            </Field>
            <Field label="Tagline">
              <Input
                value={settings.tagline || ''}
                onChange={(e) => set('tagline', e.target.value)}
                className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
              />
            </Field>
          </div>
        </section>

        <Separator />

        {/* Limits */}
        <section className="space-y-3">
          <SectionTitle icon={<HardDrive className="h-3.5 w-3.5" />}>Limits</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default expiry">
              <Select
                value={settings.defaultExpiry || 'never'}
                onValueChange={(v) => set('defaultExpiry', v)}
              >
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
            </Field>
            <Field label="Max file size (MB)">
              <Input
                type="number"
                min={1}
                value={sizeMB}
                onChange={(e) =>
                  set('maxFileSizeBytes', Math.max(0, Number(e.target.value)) * 1024 * 1024)
                }
                className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
              />
            </Field>
          </div>
          <Field label="Allowed file types (comma-separated extensions)">
            <Input
              value={settings.allowedFileTypes || ''}
              onChange={(e) => set('allowedFileTypes', e.target.value)}
              placeholder=".png, .jpg, .pdf"
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
        </section>

        <Separator />

        {/* Storage */}
        <section className="space-y-3">
          <SectionTitle icon={<HardDrive className="h-3.5 w-3.5" />}>Storage</SectionTitle>
          <Field label="Storage driver">
            <Select
              value={settings.storageDriver || 'local'}
              onValueChange={(v) => set('storageDriver', v)}
            >
              <SelectTrigger className="w-full bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local filesystem</SelectItem>
                <SelectItem value="s3">S3-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
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
        </section>

        <Separator />

        {/* SEO */}
        <section className="space-y-3">
          <SectionTitle icon={<Eye className="h-3.5 w-3.5" />}>SEO</SectionTitle>
          <Field label="Meta title template">
            <Input
              value={settings.metaTitleTemplate || ''}
              onChange={(e) => set('metaTitleTemplate', e.target.value)}
              placeholder="%s · PasteShare"
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field label="Meta description template">
            <Textarea
              rows={2}
              value={settings.metaDescriptionTemplate || ''}
              onChange={(e) => set('metaDescriptionTemplate', e.target.value)}
              className="bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
          <Field label="robots.txt">
            <Textarea
              rows={5}
              value={settings.robotsTxt || ''}
              onChange={(e) => set('robotsTxt', e.target.value)}
              className="bg-muted/30 font-mono text-xs focus-visible:ring-2 focus-visible:ring-brand"
            />
          </Field>
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="text-brand">{icon}</span>
      {children}
    </h3>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
    <div className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
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

  if (!loading && rows.length === 0) {
    return (
      <Reveal variant={fadeUp}>
        <div className="glass mx-auto max-w-md rounded-2xl p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <ShieldAlert className="h-6 w-6 text-brand" />
          </div>
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        </div>
      </Reveal>
    )
  }

  return (
    <div className={`glass overflow-hidden rounded-2xl ${SCROLLBAR_CLASS}`}>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
            <TableRow className="border-border/50 hover:bg-transparent">
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
            ) : (
              <>
                {rows.map((a, i) => {
                  const isOpen = expanded === a.id
                  let metaStr: string
                  try {
                    metaStr = JSON.stringify(a.metadata, null, 2)
                  } catch {
                    metaStr = String(a.metadata)
                  }
                  return (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                      className="border-b border-border/30 transition-colors hover:bg-brand/5"
                    >
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">{a.adminEmail || '—'}</TableCell>
                      <TableCell>
                        <ActionBadge action={a.action} />
                      </TableCell>
                      <TableCell className="text-xs">{a.targetType}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.targetId ? a.targetId.slice(0, 8) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {metaStr && metaStr !== '{}' && metaStr !== 'null' ? (
                          <div>
                            <button
                              onClick={() => setExpanded(isOpen ? null : a.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand"
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
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px]">
                                {metaStr}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  let cls = 'border-border/50'
  if (action.startsWith('delete')) cls = 'border-destructive/40 text-destructive'
  else if (action.startsWith('ban') || action.includes('suspend'))
    cls = 'border-amber-500/40 text-amber-500'
  else if (action.startsWith('update') || action.includes('verify'))
    cls = 'border-brand/40 text-brand'
  return (
    <Badge variant="outline" className={'font-mono text-[10px] ' + cls}>
      {action}
    </Badge>
  )
}
