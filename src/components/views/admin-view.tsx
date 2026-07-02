'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Flag,
  Flame,
  HardDrive,
  Loader2,
  Lock,
  MoreHorizontal,
  Pause,
  Save,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import {
  EXPIRY_OPTIONS,
  formatBytes,
  formatDate,
  formatRelativeTime,
} from '@/lib/ui-utils'
import {
  AnimatedNumber,
  Reveal,
  StaggerGroup,
  fadeUp,
  scaleIn,
  staggerContainer,
} from '@/components/motion-helpers'
import type { SafeAuditLog, SafePaste, SafeUser } from '@/lib/types'

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

const BRAND_LIME = 'oklch(0.8 0.2 125)'

const INPUT_CLASS =
  'bg-surface-3 border-border rounded-md focus-visible:ring-brand text-sm'

export function AdminView() {
  const user = useAppStore((s) => s.user)
  const goHome = useAppStore((s) => s.goHome)

  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 sm:px-6">
        <Reveal variant={fadeUp} className="mx-auto mt-12 max-w-md">
          <div className="surface rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Admin only</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You don&apos;t have permission to access the admin panel.
            </p>
            <Button
              onClick={goHome}
              className="btn-shine mt-5 bg-brand text-brand-foreground hover:bg-brand/90"
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
    {
      value: 'overview',
      label: 'Overview',
      icon: <Activity className="h-3.5 w-3.5" />,
    },
    { value: 'users', label: 'Users', icon: <UsersIcon className="h-3.5 w-3.5" /> },
    {
      value: 'content',
      label: 'Content',
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      value: 'settings',
      label: 'Settings',
      icon: <SettingsIcon className="h-3.5 w-3.5" />,
    },
    {
      value: 'audit',
      label: 'Audit Log',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 sm:px-6">
      {/* Header */}
      <Reveal variant={fadeUp} className="mb-8">
        <p className="font-mono text-xs text-brand">
          <span className="text-muted-foreground">{'>'}</span> sudo admin
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <span className="brand-dot" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, content, and site settings.
        </p>
      </Reveal>

      <Tabs
        value={tab}
        onValueChange={setTab}
        orientation="vertical"
        className="flex flex-col gap-6 lg:flex-row"
      >
        <Reveal variant={fadeUp} delay={0.05}>
          <TabsList className="grid h-fit w-full grid-cols-5 gap-1 rounded-xl bg-transparent p-0 lg:flex lg:w-56 lg:flex-col lg:grid-cols-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="font-mono flex items-center justify-start gap-2 rounded-md border-b-2 border-transparent px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-l-2 data-[state=active]:border-b-transparent data-[state=active]:border-l-brand data-[state=active]:bg-brand/10 data-[state=active]:text-brand data-[state=active]:shadow-none lg:border-b-0 lg:border-l-2"
              >
                {t.icon}
                <span>{t.label}</span>
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

/* ---------------- Overview ---------------- */

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
          <div key={i} className="shimmer surface h-28 rounded-xl" />
        ))}
        <div className="shimmer surface h-64 rounded-xl sm:col-span-2 lg:col-span-4" />
      </div>
    )
  }

  const traffic = data.traffic.map((t) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))

  const maxLang = data.topLanguages.reduce((m, l) => Math.max(m, l.count), 1)

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <StaggerGroup stagger={0.07} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Total users"
            value={data.totalUsers}
            icon={<UsersIcon className="h-4 w-4" />}
            accent
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Active pastes"
            value={data.totalActivePastes}
            icon={<FileText className="h-4 w-4" />}
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Total files"
            value={data.totalFiles}
            icon={<HardDrive className="h-4 w-4" />}
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Storage used"
            value={data.storageUsedBytes}
            format={(n) => formatBytes(n)}
            icon={<HardDrive className="h-4 w-4" />}
            accent
          />
        </Reveal>
      </StaggerGroup>

      {/* Secondary stat cards */}
      <StaggerGroup stagger={0.06} className="grid gap-4 sm:grid-cols-2">
        <Reveal variant={scaleIn}>
          <div className="surface lift flex items-center gap-4 rounded-xl p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                <AnimatedNumber value={data.flaggedCount} />
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Flagged content
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal variant={scaleIn}>
          <div className="surface lift flex items-center gap-4 rounded-xl p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-2/15 text-brand-2">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                <AnimatedNumber value={data.burnedCount} />
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Burned pastes
              </p>
            </div>
          </div>
        </Reveal>
      </StaggerGroup>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal variant={fadeUp} className="lg:col-span-2">
          <div className="surface rounded-xl p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                paste creation — 14d
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-brand" /> daily count
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={traffic}
                  margin={{ top: 5, right: 8, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND_LIME} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={BRAND_LIME} stopOpacity={0} />
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
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={BRAND_LIME}
                    strokeWidth={2.5}
                    fill="url(#trafficFill)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: BRAND_LIME,
                      stroke: 'white',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal variant={fadeUp} delay={0.05}>
          <div className="surface h-full rounded-xl p-5">
            <h3 className="font-mono mb-4 text-[11px] uppercase tracking-wider text-muted-foreground">
              top languages
            </h3>
            {data.topLanguages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No data yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.topLanguages.slice(0, 8).map((l) => (
                  <div key={l.language} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-foreground">
                        {l.language}
                      </span>
                      <span className="text-muted-foreground">{l.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-brand/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(l.count / maxLang) * 100}%` }}
                        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                        className="h-full rounded-full bg-brand"
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
  format,
  accent,
}: {
  label: string
  value: number
  icon: ReactNode
  format?: (n: number) => string
  accent?: boolean
}) {
  return (
    <div className="surface lift rounded-xl p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          accent ? 'text-brand' : 'text-foreground'
        }`}
      >
        <AnimatedNumber value={value} format={format} />
      </p>
      <div className="mt-3 text-muted-foreground">{icon}</div>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="surface-2 rounded-md p-2 text-xs">
      <p className="font-mono text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-brand">{payload[0].value} pastes</p>
    </div>
  )
}

/* ---------------- Users ---------------- */

function UsersTab() {
  const me = useAppStore((s) => s.user)!
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [confirm, setConfirm] = useState<{
    user: UserRow
    action: 'delete' | 'ban' | 'suspend'
  } | null>(null)
  const [busy, setBusy] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    try {
      const r = await api.admin.listUsers(
        q || undefined,
        status === 'all' ? undefined : status,
      )
      setRows(r)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [status])

  async function patchUser(
    u: UserRow,
    patch: { status?: string; role?: string; verify?: boolean },
  ) {
    if (u.id === me.id && (patch.status === 'banned' || patch.status === 'suspended')) {
      toast.error('You cannot suspend or ban yourself.')
      return
    }
    try {
      const res = await api.admin.updateUser(u.id, patch)
      const updated = res[0] as UserRow | undefined
      if (updated) {
        setRows((cur) => cur.map((x) => (x.id === u.id ? { ...x, ...updated } : x)))
        toast.success('User updated')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    }
  }

  async function doConfirm() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.action === 'delete') {
        if (confirm.user.id === me.id) {
          toast.error('You cannot delete yourself.')
          return
        }
        await api.admin.deleteUser(confirm.user.id)
        setRows((cur) => cur.filter((x) => x.id !== confirm.user.id))
        toast.success('User deleted')
      } else if (confirm.action === 'ban') {
        if (confirm.user.id === me.id) {
          toast.error('You cannot ban yourself.')
          return
        }
        const res = await api.admin.updateUser(confirm.user.id, { status: 'banned' })
        const updated = res[0] as UserRow | undefined
        if (updated)
          setRows((cur) =>
            cur.map((x) => (x.id === confirm.user.id ? { ...x, ...updated } : x)),
          )
        toast.success('User banned')
      } else if (confirm.action === 'suspend') {
        if (confirm.user.id === me.id) {
          toast.error('You cannot suspend yourself.')
          return
        }
        const res = await api.admin.updateUser(confirm.user.id, { status: 'suspended' })
        const updated = res[0] as UserRow | undefined
        if (updated)
          setRows((cur) =>
            cur.map((x) => (x.id === confirm.user.id ? { ...x, ...updated } : x)),
          )
        toast.success('User suspended')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Reveal variant={fadeUp}>
        <div className="surface flex flex-wrap items-center gap-2 rounded-xl p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={`${INPUT_CLASS} w-[140px]`}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_verification">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={fetchUsers}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
        </div>
      </Reveal>

      {/* Table */}
      <Reveal variant={fadeUp} delay={0.05}>
        <div className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}>
          <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-2">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pastes
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <motion.tbody
                variants={staggerContainer(0.04)}
                initial="hidden"
                animate="show"
              >
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading users…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((u) => {
                    const uname = u.displayName || u.email.split('@')[0]
                    const initials = uname.slice(0, 2).toUpperCase()
                    const isSelf = u.id === me.id
                    return (
                      <motion.tr
                        key={u.id}
                        variants={fadeUp}
                        className="border-border border-b transition-colors hover:bg-surface-3"
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[10px] font-bold text-brand-foreground">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {uname}
                                {isSelf && (
                                  <span className="ml-1.5 text-[10px] text-brand">(you)</span>
                                )}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <UserStatusBadge status={u.status} />
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {u.pasteCount ?? 0}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                          {formatRelativeTime(u.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {u.status !== 'active' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    patchUser(u, { status: 'active' })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                                </DropdownMenuItem>
                              )}
                              {u.status !== 'suspended' && !isSelf && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({ user: u, action: 'suspend' })
                                  }
                                >
                                  <Pause className="h-3.5 w-3.5" /> Suspend
                                </DropdownMenuItem>
                              )}
                              {u.status !== 'banned' && !isSelf && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirm({ user: u, action: 'ban' })
                                  }
                                >
                                  <Ban className="h-3.5 w-3.5" /> Ban
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {u.role !== 'admin' ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    patchUser(u, { role: 'admin' })
                                  }
                                >
                                  <ArrowUpCircle className="h-3.5 w-3.5" /> Promote to admin
                                </DropdownMenuItem>
                              ) : (
                                !isSelf && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      patchUser(u, { role: 'user' })
                                    }
                                  >
                                    <ArrowDownCircle className="h-3.5 w-3.5" /> Demote to user
                                  </DropdownMenuItem>
                                )
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={isSelf}
                                onClick={() =>
                                  setConfirm({ user: u, action: 'delete' })
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })
                )}
              </motion.tbody>
            </Table>
          </div>
        </div>
      </Reveal>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'delete'
                ? 'Delete user?'
                : confirm?.action === 'ban'
                  ? 'Ban user?'
                  : 'Suspend user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'delete' ? (
                <>
                  This will permanently delete{' '}
                  <span className="font-mono text-foreground">
                    {confirm?.user.email}
                  </span>{' '}
                  and all their pastes. This cannot be undone.
                </>
              ) : (
                <>
                  {confirm?.action === 'ban'
                    ? 'Banned users cannot log in.'
                    : 'Suspended users cannot log in until reactivated.'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.action === 'delete'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : 'bg-amber-500 text-white hover:bg-amber-500/90'
              }
              onClick={doConfirm}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : confirm?.action === 'delete' ? (
                'Delete'
              ) : confirm?.action === 'ban' ? (
                'Ban'
              ) : (
                'Suspend'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RoleBadge({ role }: { role: SafeUser['role'] }) {
  if (role === 'admin')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        <Shield className="h-2.5 w-2.5" /> admin
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      user
    </span>
  )
}

function UserStatusBadge({ status }: { status: SafeUser['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        active
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

/* ---------------- Content ---------------- */

function ContentTab() {
  const [rows, setRows] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [expiredOnly, setExpiredOnly] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SafePaste | null>(null)
  const [busy, setBusy] = useState(false)

  async function fetchPastes() {
    setLoading(true)
    try {
      const r = await api.admin.listPastes({
        q: q || undefined,
        flagged: flaggedOnly || undefined,
        expired: expiredOnly || undefined,
      })
      setRows(r)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load pastes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPastes()
  }, [flaggedOnly, expiredOnly])

  async function patchPaste(
    p: SafePaste,
    patch: { isFlagged?: boolean; visibility?: string; forceExpire?: boolean },
  ) {
    try {
      const res = await api.admin.updatePaste(p.id, patch)
      const updated = res[0] as SafePaste | undefined
      if (updated)
        setRows((cur) => cur.map((x) => (x.id === p.id ? updated : x)))
      toast.success('Paste updated')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await api.admin.deletePaste(confirmDelete.id)
      setRows((cur) => cur.filter((x) => x.id !== confirmDelete.id))
      toast.success('Paste deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Reveal variant={fadeUp}>
        <div className="surface flex flex-wrap items-center gap-3 rounded-xl p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, slug, or owner…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPastes()}
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={flaggedOnly}
              onCheckedChange={setFlaggedOnly}
            />
            Flagged only
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={expiredOnly}
              onCheckedChange={setExpiredOnly}
            />
            Expired only
          </label>
          <Button
            onClick={fetchPastes}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
        </div>
      </Reveal>

      {/* Table */}
      <Reveal variant={fadeUp} delay={0.05}>
        <div className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}>
          <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-2">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Title
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Lang
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Vis
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Views
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Owner
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <motion.tbody
                variants={staggerContainer(0.04)}
                initial="hidden"
                animate="show"
              >
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading pastes…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No pastes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <motion.tr
                      key={p.id}
                      variants={fadeUp}
                      className="border-border border-b transition-colors hover:bg-surface-3"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="max-w-[200px] truncate text-sm font-medium">
                            {p.title || `/${p.slug}`}
                          </p>
                          <p className="font-mono max-w-[200px] truncate text-[11px] text-muted-foreground">
                            {p.slug}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {p.contentType}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {p.language}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-[11px] capitalize text-muted-foreground">
                          {p.visibility}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono px-4 py-3 text-xs">
                        {p.viewCount}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.isExpired && (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              expired
                            </span>
                          )}
                          {p.isBurned && (
                            <span className="inline-flex items-center rounded-md bg-brand-2/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-2">
                              burned
                            </span>
                          )}
                          {p.isFlagged && (
                            <span className="inline-flex items-center rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              flagged
                            </span>
                          )}
                          {!p.isExpired && !p.isBurned && !p.isFlagged && (
                            <span className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                              active
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-[11px] text-muted-foreground">
                          {p.ownerName || 'guest'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                        {formatRelativeTime(p.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() =>
                                patchPaste(p, { isFlagged: !p.isFlagged })
                              }
                            >
                              <Flag className="h-3.5 w-3.5" />
                              {p.isFlagged ? 'Unflag' : 'Flag'}
                            </DropdownMenuItem>
                            {!p.isExpired && (
                              <DropdownMenuItem
                                onClick={() =>
                                  patchPaste(p, { forceExpire: true })
                                }
                              >
                                <Pause className="h-3.5 w-3.5" /> Force expire
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmDelete(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </motion.tbody>
            </Table>
          </div>
        </div>
      </Reveal>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete paste?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-mono text-foreground">
                {confirmDelete?.slug}
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={doDelete}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------------- Settings ---------------- */

type Settings = Record<string, unknown>

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

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

  function setField<K extends string>(key: K, value: unknown) {
    setSettings((cur) => (cur ? { ...cur, [key]: value } : cur))
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      const patch: Record<string, unknown> = { ...settings }
      // maxFileSizeBytes stored as bytes; UI shows MB.
      if (typeof settings.maxFileSizeBytes === 'number') {
        patch.maxFileSizeBytes = settings.maxFileSizeBytes
      }
      await api.admin.updateSettings(patch)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="surface rounded-2xl p-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    )
  }

  const maxFileSizeMB =
    typeof settings.maxFileSizeBytes === 'number'
      ? Math.max(1, Math.round(settings.maxFileSizeBytes / (1024 * 1024)))
      : 10

  return (
    <Reveal variant={fadeUp}>
      <div className="surface rounded-2xl p-6">
        {/* General */}
        <SectionHeader>General</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name">
            <Input
              value={String(settings.siteName ?? '')}
              onChange={(e) => setField('siteName', e.target.value)}
              className={INPUT_CLASS}
              placeholder="PasteShare"
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={String(settings.tagline ?? '')}
              onChange={(e) => setField('tagline', e.target.value)}
              className={INPUT_CLASS}
              placeholder="Share code & files, beautifully."
            />
          </Field>
        </div>

        <Divider />

        {/* Limits */}
        <SectionHeader>Limits</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default expiry">
            <Select
              value={String(settings.defaultExpiry ?? 'never')}
              onValueChange={(v) => setField('defaultExpiry', v)}
            >
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
          </Field>
          <Field label="Max file size (MB)">
            <Input
              type="number"
              min={1}
              value={maxFileSizeMB}
              onChange={(e) =>
                setField(
                  'maxFileSizeBytes',
                  Math.max(1, Number(e.target.value || 0)) * 1024 * 1024,
                )
              }
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Allowed file types">
            <Input
              value={String(settings.allowedFileTypes ?? '')}
              onChange={(e) => setField('allowedFileTypes', e.target.value)}
              className={INPUT_CLASS}
              placeholder="image/*,text/*,application/pdf"
            />
          </Field>
          <Field label="Guest posting">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.guestPostingEnabled)}
                onCheckedChange={(c) => setField('guestPostingEnabled', c)}
              />
              <span className="text-xs text-muted-foreground">
                Allow anonymous paste creation
              </span>
            </div>
          </Field>
        </div>

        <Divider />

        {/* Storage */}
        <SectionHeader>Storage</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Storage driver">
            <Select
              value={String(settings.storageDriver ?? 'local')}
              onValueChange={(v) => setField('storageDriver', v)}
            >
              <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local filesystem</SelectItem>
                <SelectItem value="s3">S3-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sitemap">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.sitemapEnabled)}
                onCheckedChange={(c) => setField('sitemapEnabled', c)}
              />
              <span className="text-xs text-muted-foreground">
                Generate sitemap.xml
              </span>
            </div>
          </Field>
        </div>

        <Divider />

        {/* SEO */}
        <SectionHeader>SEO</SectionHeader>
        <div className="space-y-4">
          <Field label="Meta title template">
            <Input
              value={String(settings.metaTitleTemplate ?? '')}
              onChange={(e) => setField('metaTitleTemplate', e.target.value)}
              className={INPUT_CLASS}
              placeholder="%s — PasteShare"
            />
          </Field>
          <Field label="Meta description template">
            <Input
              value={String(settings.metaDescriptionTemplate ?? '')}
              onChange={(e) => setField('metaDescriptionTemplate', e.target.value)}
              className={INPUT_CLASS}
              placeholder="A code & file sharing platform."
            />
          </Field>
          <Field label="robots.txt">
            <Textarea
              value={String(settings.robotsTxt ?? '')}
              onChange={(e) => setField('robotsTxt', e.target.value)}
              className={`${INPUT_CLASS} min-h-[120px] font-mono text-xs`}
              placeholder="User-agent: *"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={save}
            disabled={saving}
            className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save settings
          </Button>
        </div>
      </div>
    </Reveal>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-mono mb-4 text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

function Divider() {
  return <div className="my-6 h-px bg-border" />
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/* ---------------- Audit ---------------- */

function AuditTab() {
  const [rows, setRows] = useState<SafeAuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.admin
      .listAudit(100)
      .then((r) => {
        if (active) setRows(r)
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
    <Reveal variant={fadeUp}>
      <div className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}>
        <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface-2">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Time
                </TableHead>
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Admin
                </TableHead>
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Action
                </TableHead>
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target
                </TableHead>
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target ID
                </TableHead>
                <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Metadata
                </TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={staggerContainer(0.03)}
              initial="hidden"
              animate="show"
            >
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                    Loading audit log…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => (
                  <motion.tr
                    key={a.id}
                    variants={fadeUp}
                    className="border-border border-b transition-colors hover:bg-surface-3"
                  >
                    <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                      {formatDate(a.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs">{a.adminEmail || 'system'}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <ActionBadge action={a.action} />
                    </TableCell>
                    <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                      {a.targetType}
                    </TableCell>
                    <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                      <span className="block max-w-[120px] truncate">
                        {a.targetId}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <MetadataCell data={a.metadata} />
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </Table>
        </div>
      </div>
    </Reveal>
  )
}

function ActionBadge({ action }: { action: string }) {
  const lower = action.toLowerCase()
  if (lower.includes('delete'))
    return (
      <span className="inline-flex items-center rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        {action}
      </span>
    )
  if (lower.includes('ban') || lower.includes('suspend'))
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
        {action}
      </span>
    )
  if (lower.includes('update') || lower.includes('edit') || lower.includes('set'))
    return (
      <span className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        {action}
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {action}
    </span>
  )
}

function MetadataCell({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false)
  const text = useMemo(() => {
    if (data === null || data === undefined) return ''
    if (typeof data === 'string') return data
    try {
      return JSON.stringify(data)
    } catch {
      return String(data)
    }
  }, [data])

  if (!text) return <span className="text-[11px] text-muted-foreground">—</span>

  return (
    <div className="flex items-center gap-1">
      <span className="max-w-[160px] truncate font-mono text-[11px] text-muted-foreground">
        {text}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3 w-3" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Metadata</AlertDialogTitle>
          </AlertDialogHeader>
          <pre className="surface-3 max-h-[40vh] overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap break-all">
            {text}
          </pre>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
