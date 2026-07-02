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
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  BarChart3,
  CalendarPlus,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  Eye,
  FileText,
  Flag,
  Flame,
  HardDrive,
  Loader2,
  Lock,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  Trash2,
  Users as UsersIcon,
  X,
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

type Role = {
  id: string
  name: string
  description: string | null
  color: string | null
  isSystem: boolean
  userCount: number
  createdAt: string
  permissions: {
    id: string
    name: string
    description: string | null
    category: string
  }[]
}

type Permission = {
  id: string
  name: string
  description: string | null
  category: string
}

type Plan = {
  id: string
  name: string
  description: string | null
  monthlyPrice: number
  maxStorageBytes: number
  maxPasteSize: number
  maxPastesPerMonth: number
  allowedExpiryPresets: string[]
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
}

type Subscription = {
  id: string
  userId: string
  planId: string
  status: string
  startedAt: string
  expiresAt: string | null
  createdAt: string
  user: { id: string; email: string; displayName: string | null } | null
  plan: { id: string; name: string; monthlyPrice: number } | null
}

type UsageRow = {
  user: {
    id: string
    email: string
    displayName: string | null
    role: string
    status: string
  }
  subscription: {
    id: string
    status: string
    expiresAt: string | null
    plan: { id: string; name: string; maxStorageBytes: number }
  } | null
  usage: {
    storageBytes: number
    pasteCount: number
    fileCount: number
    monthPasteCount: number
    totalPastes: number
    totalViews: number
  }
}

type PlanForm = {
  name: string
  description: string
  monthlyPrice: string
  maxStorageBytes: string
  maxPasteSize: string
  maxPastesPerMonth: string
  allowedExpiryPresets: string
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
  isActive: boolean
  sortOrder: string
}

type PlanFlagKey =
  | 'allowCustomExpiry'
  | 'allowBurnAfterRead'
  | 'allowPassword'
  | 'allowPrivate'
  | 'allowFileUpload'

const PLAN_FEATURE_FLAGS: { key: PlanFlagKey; label: string }[] = [
  { key: 'allowCustomExpiry', label: 'Custom expiry' },
  { key: 'allowBurnAfterRead', label: 'Burn after read' },
  { key: 'allowPassword', label: 'Password' },
  { key: 'allowPrivate', label: 'Private' },
  { key: 'allowFileUpload', label: 'File upload' },
]

const ROLE_COLOR_MAP: Record<string, string> = {
  brand: 'bg-brand',
  'brand-2': 'bg-brand-2',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}

const ROLE_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'brand', label: 'Lime' },
  { value: 'brand-2', label: 'Coral' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
]

const SCROLLBAR_CLASS =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30'

const BRAND_LIME = 'oklch(0.8 0.2 125)'

const INPUT_CLASS =
  'bg-surface-3 border-border rounded-md focus-visible:ring-brand text-sm'

/** Languages offered in the Edit-paste dialog (compact subset). */
const EDIT_LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
]

const EDIT_EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '10m', label: '10 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
  { value: '1M', label: '1 month' },
  { value: '1y', label: '1 year' },
  { value: 'custom', label: 'Custom…' },
]

const PRESET_MS: Record<string, number> = {
  '10m': 10 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
}

type EditForm = {
  title: string
  description: string
  tags: string
  language: string
  visibility: 'public' | 'unlisted' | 'private'
  textContent: string
  textFetchOk: boolean
  textLoading: boolean
  viewCount: string
  expiryPreset: string
  expiryCustom: string
}

/** Reverse-engineer the expiry preset from a paste's expiresAt vs createdAt. */
function deriveExpiryFromPaste(p: SafePaste): {
  preset: string
  custom: string
} {
  if (!p.expiresAt) return { preset: 'never', custom: '' }
  const created = new Date(p.createdAt).getTime()
  const expires = new Date(p.expiresAt).getTime()
  const diffMs = expires - created
  for (const [value, ms] of Object.entries(PRESET_MS)) {
    if (Math.abs(diffMs - ms) < 60 * 1000) {
      return { preset: value, custom: '' }
    }
  }
  // Custom — fill datetime-local in local time.
  const dt = new Date(p.expiresAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const custom = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
    dt.getDate(),
  )}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  return { preset: 'custom', custom }
}

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
      value: 'roles',
      label: 'Roles',
      icon: <Shield className="h-3.5 w-3.5" />,
    },
    {
      value: 'plans',
      label: 'Plans',
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    {
      value: 'subscriptions',
      label: 'Subscriptions',
      icon: <CalendarPlus className="h-3.5 w-3.5" />,
    },
    {
      value: 'usage',
      label: 'Usage',
      icon: <BarChart3 className="h-3.5 w-3.5" />,
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
          <TabsList className="grid h-fit w-full grid-cols-3 gap-1 rounded-xl bg-transparent p-0 sm:grid-cols-5 lg:flex lg:w-56 lg:flex-col lg:grid-cols-1">
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
          <TabsContent value="roles" className="mt-0">
            <RolesTab />
          </TabsContent>
          <TabsContent value="plans" className="mt-0">
            <PlansTab />
          </TabsContent>
          <TabsContent value="subscriptions" className="mt-0">
            <SubscriptionsTab />
          </TabsContent>
          <TabsContent value="usage" className="mt-0">
            <UsageTab />
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

      {/* Trending */}
      <TrendingWidget />
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

/* ---------------- Trending Widget (Overview) ---------------- */

function TrendingWidget() {
  const goView = useAppStore((s) => s.goView)
  const [days, setDays] = useState<number>(7)
  const [rows, setRows] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.admin
      .trending(5, days)
      .then((r) => {
        if (active) setRows(r)
      })
      .catch((err) => {
        if (active)
          toast.error(
            err instanceof ApiError
              ? err.message
              : 'Failed to load trending pastes.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [days])

  const ranges: { value: number; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 0, label: 'All' },
  ]

  return (
    <Reveal variant={fadeUp}>
      <div className="surface rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-brand-2" />
            trending now
          </h3>
          <div className="flex items-center gap-1 rounded-md bg-surface-3 p-0.5">
            {ranges.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDays(r.value)}
                className={`rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  days === r.value
                    ? 'bg-brand/15 text-brand'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer h-11 rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No trending pastes yet.
          </p>
        ) : (
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
            className="space-y-0.5"
          >
            {rows.map((p, i) => (
              <motion.button
                key={p.id}
                variants={fadeUp}
                type="button"
                onClick={() => goView(p.slug)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-3"
              >
                <span className="font-mono w-5 text-center text-sm font-semibold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.title || `/${p.slug}`}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatRelativeTime(p.createdAt)}
                  </p>
                </div>
                <span className="font-mono shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {p.language}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {p.viewCount}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </Reveal>
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
  // Edit dialog state
  const [editTarget, setEditTarget] = useState<SafePaste | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  // View-count dialog state
  const [viewCountTarget, setViewCountTarget] = useState<SafePaste | null>(null)
  const [viewCountInput, setViewCountInput] = useState('')
  const [viewCountSaving, setViewCountSaving] = useState(false)

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

  /** Silent refetch (no loading flicker) — used after mutations. */
  async function refreshList() {
    try {
      const r = await api.admin.listPastes({
        q: q || undefined,
        flagged: flaggedOnly || undefined,
        expired: expiredOnly || undefined,
      })
      setRows(r)
    } catch {
      /* silent — mutation toast already surfaced */
    }
  }

  async function openEdit(p: SafePaste) {
    const { preset, custom } = deriveExpiryFromPaste(p)
    setEditTarget(p)
    setEditForm({
      title: p.title || '',
      description: p.description || '',
      tags: p.tags.join(', '),
      language: p.language || 'plaintext',
      visibility: p.visibility,
      textContent: '',
      textFetchOk: false,
      textLoading: false,
      viewCount: String(p.viewCount),
      expiryPreset: preset,
      expiryCustom: custom,
    })
    // For safe text pastes, fetch existing content so the admin can edit it.
    // Skip for expired/burned/burn-after-read (fetching would hard-delete or burn).
    if (p.contentType === 'text' && !p.isExpired && !p.isBurned && !p.burnAfterRead) {
      setEditLoading(true)
      setEditForm((f) => (f ? { ...f, textLoading: true } : f))
      try {
        const res = await api.getPaste(p.slug)
        const full = res[0]
        setEditForm((f) =>
          f
            ? {
                ...f,
                textContent: full?.textContent ?? '',
                textFetchOk: true,
                textLoading: false,
              }
            : f,
        )
      } catch {
        setEditForm((f) => (f ? { ...f, textFetchOk: false, textLoading: false } : f))
      } finally {
        setEditLoading(false)
      }
    } else if (p.contentType === 'text') {
      // Unsafe to fetch — leave textContent empty; save only sends if user typed.
      setEditForm((f) => (f ? { ...f, textFetchOk: false, textLoading: false } : f))
    } else {
      // File paste — no text content field.
      setEditForm((f) => (f ? { ...f, textFetchOk: true, textLoading: false } : f))
    }
  }

  function closeEdit() {
    setEditTarget(null)
    setEditForm(null)
  }

  async function saveEdit() {
    if (!editTarget || !editForm) return
    setEditSaving(true)
    try {
      const patch: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        tags: editForm.tags.trim(),
        language: editForm.language,
        visibility: editForm.visibility,
        viewCount: Math.max(0, parseInt(editForm.viewCount, 10) || 0),
      }
      // textContent: send if we loaded it (even empty = explicit clear),
      // OR if user typed new content into an unloaded field.
      if (editTarget.contentType === 'text') {
        if (editForm.textFetchOk || editForm.textContent.length > 0) {
          patch.textContent = editForm.textContent
        }
      }
      // Expiry
      if (editForm.expiryPreset === 'never') {
        patch.expiresAt = null
      } else if (editForm.expiryPreset === 'custom') {
        if (editForm.expiryCustom) {
          const d = new Date(editForm.expiryCustom)
          if (!isNaN(d.getTime())) patch.expiresAt = d.toISOString()
        }
      } else {
        const ms = PRESET_MS[editForm.expiryPreset]
        if (ms) patch.expiresAt = new Date(Date.now() + ms).toISOString()
      }
      await api.admin.editPaste(editTarget.id, patch)
      toast.success('Paste updated')
      closeEdit()
      await refreshList()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setEditSaving(false)
    }
  }

  async function resetViews(p: SafePaste) {
    try {
      await api.admin.editPaste(p.id, { resetViews: true })
      toast.success('View count reset to 0')
      await refreshList()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reset failed.')
    }
  }

  function openViewCountEdit(p: SafePaste) {
    setViewCountTarget(p)
    setViewCountInput(String(p.viewCount))
  }

  function closeViewCountEdit() {
    setViewCountTarget(null)
    setViewCountInput('')
  }

  async function saveViewCount() {
    if (!viewCountTarget) return
    const n = Math.max(0, parseInt(viewCountInput, 10) || 0)
    setViewCountSaving(true)
    try {
      await api.admin.editPaste(viewCountTarget.id, { viewCount: n })
      toast.success(`View count set to ${n}`)
      closeViewCountEdit()
      await refreshList()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.')
    } finally {
      setViewCountSaving(false)
    }
  }

  // Default view hides expired + burned pastes (backend hard-deletes on access,
  // but some may linger). "Expired only" toggle surfaces them via ?expired=1.
  const displayedRows = expiredOnly
    ? rows
    : rows.filter((p) => !p.isExpired && !p.isBurned)

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
                ) : displayedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {expiredOnly
                        ? 'No expired pastes found.'
                        : flaggedOnly
                          ? 'No flagged pastes found.'
                          : 'No pastes found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedRows.map((p) => (
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => resetViews(p)}>
                              <RotateCcw className="h-3.5 w-3.5" /> Reset views
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openViewCountEdit(p)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Edit view count
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => !o && !editSaving && closeEdit()}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit paste</DialogTitle>
            <DialogDescription>
              Update details for{' '}
              <span className="font-mono text-foreground">
                {editTarget?.slug}
              </span>
              {editTarget?.contentType === 'file' &&
                editTarget.originalFileName && (
                  <> · {editTarget.originalFileName}</>
                )}
            </DialogDescription>
          </DialogHeader>
          {editForm && editTarget && (
            <div className="space-y-4 py-2">
              {/* Title */}
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Title
                </Label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                  placeholder="Untitled paste"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, description: e.target.value } : f))
                  }
                  placeholder="Brief description (optional)"
                  rows={2}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Tags + Language */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Tags
                  </Label>
                  <Input
                    value={editForm.tags}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, tags: e.target.value } : f))
                    }
                    placeholder="react, typescript, web"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Language
                  </Label>
                  <Select
                    value={editForm.language}
                    onValueChange={(v) =>
                      setEditForm((f) => (f ? { ...f, language: v } : f))
                    }
                  >
                    <SelectTrigger className={INPUT_CLASS}>
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {!EDIT_LANGUAGES.some(
                        (l) => l.value === editForm.language,
                      ) && (
                        <SelectItem value={editForm.language}>
                          {editForm.language}
                        </SelectItem>
                      )}
                      {EDIT_LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Visibility
                </Label>
                <Select
                  value={editForm.visibility}
                  onValueChange={(v) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            visibility: v as 'public' | 'unlisted' | 'private',
                          }
                        : f,
                    )
                  }
                >
                  <SelectTrigger className={INPUT_CLASS}>
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Text content (text pastes only) */}
              {editTarget.contentType === 'text' && (
                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Content
                    {editForm.textLoading ? (
                      <span className="ml-1 text-brand">(loading…)</span>
                    ) : !editForm.textFetchOk ? (
                      <span className="ml-1 text-muted-foreground/70">
                        (enter new to replace)
                      </span>
                    ) : null}
                  </Label>
                  <Textarea
                    value={editForm.textContent}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, textContent: e.target.value } : f))
                    }
                    placeholder={
                      editForm.textFetchOk
                        ? 'Paste content…'
                        : 'Type new content to replace existing…'
                    }
                    rows={7}
                    disabled={editForm.textLoading}
                    className={`${INPUT_CLASS} font-mono text-xs`}
                  />
                </div>
              )}

              {/* View count */}
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  View count
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={editForm.viewCount}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, viewCount: e.target.value } : f))
                    }
                    className={INPUT_CLASS}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      setEditForm((f) => (f ? { ...f, viewCount: '0' } : f))
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                </div>
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Expiry
                </Label>
                <Select
                  value={editForm.expiryPreset}
                  onValueChange={(v) =>
                    setEditForm((f) => (f ? { ...f, expiryPreset: v } : f))
                  }
                >
                  <SelectTrigger className={INPUT_CLASS}>
                    <SelectValue placeholder="Expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDIT_EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.expiryPreset === 'custom' && (
                  <Input
                    type="datetime-local"
                    value={editForm.expiryCustom}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, expiryCustom: e.target.value } : f))
                    }
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={saveEdit}
              disabled={editSaving || editLoading}
            >
              {editSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View count dialog */}
      <Dialog
        open={!!viewCountTarget}
        onOpenChange={(o) => !o && !viewCountSaving && closeViewCountEdit()}
      >
        <DialogContent className="surface-2 max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit view count</DialogTitle>
            <DialogDescription>
              Set the view count for{' '}
              <span className="font-mono text-foreground">
                {viewCountTarget?.slug}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              View count
            </Label>
            <Input
              type="number"
              min={0}
              value={viewCountInput}
              onChange={(e) => setViewCountInput(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeViewCountEdit}
              disabled={viewCountSaving}
            >
              Cancel
            </Button>
            <Button
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={saveViewCount}
              disabled={viewCountSaving}
            >
              {viewCountSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

/* ---------------- Roles ---------------- */

function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('brand')
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  async function fetchRoles() {
    setLoading(true)
    try {
      const [r, p] = await Promise.all([
        api.admin.listRoles(),
        api.admin.listPermissions(),
      ])
      setRoles(r)
      setPermissions(p)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load roles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setColor('brand')
    setSelectedPerms(new Set())
    setDialogOpen(true)
  }

  function openEdit(role: Role) {
    setEditing(role)
    setName(role.name)
    setDescription(role.description || '')
    setColor(role.color || 'brand')
    setSelectedPerms(new Set(role.permissions.map((p) => p.id)))
    setDialogOpen(true)
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        permissionIds: [...selectedPerms],
      }
      if (editing) {
        await api.admin.updateRole(editing.id, body)
        toast.success('Role updated')
      } else {
        await api.admin.createRole(body)
        toast.success('Role created')
      }
      setDialogOpen(false)
      fetchRoles()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api.admin.deleteRole(deleteTarget.id)
      toast.success('Role deleted')
      setDeleteTarget(null)
      fetchRoles()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const permsByCategory = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = map.get(p.category) || []
      arr.push(p)
      map.set(p.category, arr)
    }
    return [...map.entries()]
  }, [permissions])

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brand">
              <span className="text-muted-foreground">{'>'}</span> sudo roles
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Roles &amp; Permissions
            </h2>
          </div>
          <Button
            onClick={openCreate}
            className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> Create Role
          </Button>
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="shimmer surface h-44 rounded-xl" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <Reveal variant={fadeUp}>
          <div className="surface rounded-xl p-10 text-center text-sm text-muted-foreground">
            No custom roles.
          </div>
        </Reveal>
      ) : (
        <StaggerGroup
          stagger={0.05}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {roles.map((role) => {
            const grouped = new Map<string, Permission[]>()
            for (const p of role.permissions) {
              const arr = grouped.get(p.category) || []
              arr.push(p)
              grouped.set(p.category, arr)
            }
            const dotClass =
              ROLE_COLOR_MAP[role.color || 'brand'] || 'bg-brand'
            return (
              <Reveal key={role.id} variant={fadeUp}>
                <div className="surface lift flex h-full flex-col rounded-xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
                      />
                      <h3 className="text-base font-semibold">{role.name}</h3>
                      {role.isSystem && (
                        <span className="font-mono rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                          System
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {role.userCount} users
                    </span>
                  </div>
                  {role.description && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                  <div className="mt-3 flex-1 space-y-2">
                    {[...grouped.entries()].map(([cat, perms]) => (
                      <div key={cat}>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                          {cat}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {perms.map((p) => (
                            <span
                              key={p.id}
                              className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {role.permissions.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        No permissions assigned.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => openEdit(role)}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-destructive hover:text-destructive"
                      disabled={role.isSystem}
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </StaggerGroup>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !busy && setDialogOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit role' : 'Create role'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update ${editing.name}`
                : 'Define a new role and its permissions.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="editor"
                  className={INPUT_CLASS}
                  disabled={editing?.isSystem}
                />
              </Field>
              <Field label="Color">
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_COLOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can edit other users' pastes"
                className={INPUT_CLASS}
              />
            </Field>
            <div>
              <p className="font-mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Permissions
              </p>
              <div
                className={`surface-3 max-h-[40vh] space-y-3 overflow-y-auto rounded-md p-3 ${SCROLLBAR_CLASS}`}
              >
                {permsByCategory.map(([cat, perms]) => (
                  <div key={cat}>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {cat}
                    </p>
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                      {perms.map((p) => {
                        const checked = selectedPerms.has(p.id)
                        return (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-start gap-2 rounded p-1 hover:bg-surface-2"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedPerms((cur) => {
                                  const next = new Set(cur)
                                  if (v === true) next.add(p.id)
                                  else next.delete(p.id)
                                  return next
                                })
                              }}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="font-mono block text-[11px] text-foreground">
                                {p.name}
                              </span>
                              {p.description && (
                                <span className="block text-[10px] text-muted-foreground">
                                  {p.description}
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editing ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !busy && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{' '}
              <span className="font-mono text-foreground">
                {deleteTarget?.name}
              </span>
              . Users with this role will be reassigned to the default user
              role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
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

/* ---------------- Plans ---------------- */

function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState<PlanForm>({
    name: '',
    description: '',
    monthlyPrice: '0',
    maxStorageBytes: '52428800',
    maxPasteSize: '1048576',
    maxPastesPerMonth: '20',
    allowedExpiryPresets: 'never,10m,1h,1d',
    allowCustomExpiry: false,
    allowBurnAfterRead: true,
    allowPassword: true,
    allowPrivate: false,
    allowFileUpload: true,
    isActive: true,
    sortOrder: '0',
  })
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null)

  async function fetchPlans() {
    setLoading(true)
    try {
      const r = await api.admin.listPlans()
      setPlans([...r].sort((a, b) => a.sortOrder - b.sortOrder))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      name: '',
      description: '',
      monthlyPrice: '0',
      maxStorageBytes: '52428800',
      maxPasteSize: '1048576',
      maxPastesPerMonth: '20',
      allowedExpiryPresets: 'never,10m,1h,1d',
      allowCustomExpiry: false,
      allowBurnAfterRead: true,
      allowPassword: true,
      allowPrivate: false,
      allowFileUpload: true,
      isActive: true,
      sortOrder: '0',
    })
    setDialogOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description || '',
      monthlyPrice: String(plan.monthlyPrice),
      maxStorageBytes: String(plan.maxStorageBytes),
      maxPasteSize: String(plan.maxPasteSize),
      maxPastesPerMonth: String(plan.maxPastesPerMonth),
      allowedExpiryPresets: plan.allowedExpiryPresets.join(','),
      allowCustomExpiry: plan.allowCustomExpiry,
      allowBurnAfterRead: plan.allowBurnAfterRead,
      allowPassword: plan.allowPassword,
      allowPrivate: plan.allowPrivate,
      allowFileUpload: plan.allowFileUpload,
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
    })
    setDialogOpen(true)
  }

  function setFlag(key: PlanFlagKey, value: boolean) {
    setForm((cur) => ({ ...cur, [key]: value }))
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Name is required.')
      return
    }
    setBusy(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        monthlyPrice: Number(form.monthlyPrice) || 0,
        maxStorageBytes: Number(form.maxStorageBytes) || 0,
        maxPasteSize: Number(form.maxPasteSize) || 0,
        maxPastesPerMonth: Number(form.maxPastesPerMonth) || 0,
        allowedExpiryPresets: form.allowedExpiryPresets
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        allowCustomExpiry: form.allowCustomExpiry,
        allowBurnAfterRead: form.allowBurnAfterRead,
        allowPassword: form.allowPassword,
        allowPrivate: form.allowPrivate,
        allowFileUpload: form.allowFileUpload,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      }
      if (editing) {
        await api.admin.updatePlan(editing.id, body)
        toast.success('Plan updated')
      } else {
        await api.admin.createPlan(body)
        toast.success('Plan created')
      }
      setDialogOpen(false)
      fetchPlans()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api.admin.deletePlan(deleteTarget.id)
      toast.success('Plan deleted')
      setDeleteTarget(null)
      fetchPlans()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brand">
              <span className="text-muted-foreground">{'>'}</span> sudo plans
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Subscription Plans
            </h2>
          </div>
          <Button
            onClick={openCreate}
            className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> Create Plan
          </Button>
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer surface h-64 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Reveal variant={fadeUp}>
          <div className="surface rounded-xl p-10 text-center text-sm text-muted-foreground">
            No plans configured.
          </div>
        </Reveal>
      ) : (
        <StaggerGroup
          stagger={0.05}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {plans.map((plan) => (
            <Reveal key={plan.id} variant={fadeUp}>
              <div className="surface lift flex h-full flex-col rounded-xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {plan.isSystem && (
                      <span className="font-mono rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        System
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      plan.isActive
                        ? 'bg-brand/15 text-brand'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-semibold text-brand">
                  {plan.monthlyPrice > 0
                    ? `$${plan.monthlyPrice.toFixed(2)}/mo`
                    : 'Free'}
                </p>
                {plan.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                )}
                <dl className="font-mono mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">storage</dt>
                    <dd>{formatBytes(plan.maxStorageBytes)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">max paste</dt>
                    <dd>{formatBytes(plan.maxPasteSize)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">per month</dt>
                    <dd>{plan.maxPastesPerMonth}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">expiry</dt>
                    <dd className="max-w-[160px] truncate">
                      {plan.allowedExpiryPresets.join(', ') || '\u2014'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  {PLAN_FEATURE_FLAGS.map((f) => {
                    const on = plan[f.key] as boolean
                    return (
                      <span
                        key={f.key}
                        className="inline-flex items-center gap-1 text-[10px]"
                      >
                        {on ? (
                          <Check className="h-3 w-3 text-brand" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span
                          className={
                            on ? 'text-foreground' : 'text-muted-foreground'
                          }
                        >
                          {f.label}
                        </span>
                      </span>
                    )
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => openEdit(plan)}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-destructive hover:text-destructive"
                    disabled={plan.isSystem}
                    onClick={() => setDeleteTarget(plan)}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </StaggerGroup>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !busy && setDialogOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit plan' : 'Create plan'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update ${editing.name}`
                : 'Define a new subscription plan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, name: e.target.value }))
                  }
                  className={INPUT_CLASS}
                  disabled={editing?.isSystem}
                />
              </Field>
              <Field label="Monthly price ($)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthlyPrice}
                  onChange={(e) =>
                    setForm((cur) => ({
                      ...cur,
                      monthlyPrice: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((cur) => ({
                    ...cur,
                    description: e.target.value,
                  }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Max storage (B)">
                <Input
                  type="number"
                  min={0}
                  value={form.maxStorageBytes}
                  onChange={(e) =>
                    setForm((cur) => ({
                      ...cur,
                      maxStorageBytes: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Max paste size (B)">
                <Input
                  type="number"
                  min={0}
                  value={form.maxPasteSize}
                  onChange={(e) =>
                    setForm((cur) => ({
                      ...cur,
                      maxPasteSize: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Max pastes / month">
                <Input
                  type="number"
                  min={0}
                  value={form.maxPastesPerMonth}
                  onChange={(e) =>
                    setForm((cur) => ({
                      ...cur,
                      maxPastesPerMonth: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <Field label="Allowed expiry presets (comma-separated)">
              <Input
                value={form.allowedExpiryPresets}
                onChange={(e) =>
                  setForm((cur) => ({
                    ...cur,
                    allowedExpiryPresets: e.target.value,
                  }))
                }
                className={`${INPUT_CLASS} font-mono text-xs`}
                placeholder="never,10m,1h,1d,1w,1M,1y"
              />
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, sortOrder: e.target.value }))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <div className="surface-3 grid gap-2 rounded-md p-3 sm:grid-cols-2">
              {PLAN_FEATURE_FLAGS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-muted-foreground">{f.label}</span>
                  <Switch
                    checked={form[f.key] as boolean}
                    onCheckedChange={(v) => setFlag(f.key, v)}
                  />
                </label>
              ))}
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Active</span>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) =>
                    setForm((cur) => ({ ...cur, isActive: v }))
                  }
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !busy && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{' '}
              <span className="font-mono text-foreground">
                {deleteTarget?.name}
              </span>
              . Subscribers will be reassigned to the Free plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
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

/* ---------------- Subscriptions ---------------- */

function SubscriptionsTab() {
  const [rows, setRows] = useState<Subscription[]>([])
  const [expiring, setExpiring] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [planId, setPlanId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)

  async function fetchSubs() {
    setLoading(true)
    try {
      const [r, e] = await Promise.all([
        api.admin.listSubscriptions(
          statusFilter === 'all' ? undefined : statusFilter,
        ),
        api.admin.listExpiringSubscriptions(),
      ])
      setRows(r)
      setExpiring(e)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to load subscriptions.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubs()
  }, [statusFilter])

  async function openAssign() {
    try {
      const [u, p] = await Promise.all([
        api.admin.listUsers(),
        api.admin.listPlans(),
      ])
      setUsers(u)
      setPlans([...p].sort((a, b) => a.sortOrder - b.sortOrder))
      setUserId('')
      setPlanId(p[0]?.id || '')
      setExpiresAt('')
      setUserQuery('')
      setDialogOpen(true)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to load users/plans.',
      )
    }
  }

  async function assign() {
    if (!userId) {
      toast.error('Pick a user.')
      return
    }
    if (!planId) {
      toast.error('Pick a plan.')
      return
    }
    setBusy(true)
    try {
      await api.admin.assignSubscription({
        userId,
        planId,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      toast.success('Subscription assigned')
      setDialogOpen(false)
      fetchSubs()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Assign failed.')
    } finally {
      setBusy(false)
    }
  }

  async function extend(sub: Subscription, days: number) {
    const now = Date.now()
    let base: number
    if (sub.expiresAt) {
      const e = new Date(sub.expiresAt).getTime()
      base = e > now ? e : now
    } else {
      base = now
    }
    const next = new Date(base + days * 86400000).toISOString()
    try {
      await api.admin.updateSubscription(sub.id, {
        status: 'active',
        expiresAt: next,
      })
      toast.success(`Extended by ${days} days`)
      fetchSubs()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Extend failed.')
    }
  }

  async function cancel(sub: Subscription) {
    try {
      await api.admin.cancelSubscription(sub.id)
      toast.success('Subscription cancelled')
      fetchSubs()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cancel failed.')
    }
  }

  async function changePlan(sub: Subscription) {
    try {
      const all = await api.admin.listPlans()
      const active = all.filter((p) => p.isActive)
      const next = active.find((p) => p.id !== sub.planId) || active[0]
      if (!next) {
        toast.error('No active plans available.')
        return
      }
      await api.admin.updateSubscription(sub.id, {
        planId: next.id,
        status: 'active',
      })
      toast.success(`Plan changed to ${next.name}`)
      fetchSubs()
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Change plan failed.',
      )
    }
  }

  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users.slice(0, 50)
    const q = userQuery.toLowerCase()
    return users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.displayName || '').toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [users, userQuery])

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brand">
              <span className="text-muted-foreground">{'>'}</span> sudo
              subscriptions
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Subscriptions
            </h2>
          </div>
          <Button
            onClick={openAssign}
            className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> Assign
          </Button>
        </div>
      </Reveal>

      {expiring.length > 0 && (
        <Reveal variant={fadeUp}>
          <div className="surface rounded-xl border-brand-2/30 p-4">
            <div className="flex items-center gap-2 text-brand-2">
              <AlertTriangle className="h-4 w-4" />
              <p className="font-mono text-[11px] uppercase tracking-wider">
                {expiring.length} subscriptions expiring within 7 days
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {expiring.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">
                    <span className="font-medium">
                      {s.user?.email || 'unknown'}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      &mdash; {s.plan?.name || '\u2014'}
                    </span>
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {s.expiresAt ? formatDate(s.expiresAt) : '\u2014'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      <Reveal variant={fadeUp}>
        <div className="flex flex-wrap gap-1.5">
          {['all', 'active', 'expired', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`font-mono rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal variant={fadeUp} delay={0.05}>
        <div
          className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}
        >
          <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-2">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Plan
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Started
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Expires
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
                    <TableCell
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading subscriptions&hellip;
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((s) => (
                    <motion.tr
                      key={s.id}
                      variants={fadeUp}
                      className="border-border border-b transition-colors hover:bg-surface-3"
                    >
                      <TableCell className="px-4 py-3">
                        <p className="text-sm font-medium">
                          {s.user?.email || 'unknown'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.user?.displayName || '\u2014'}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <p className="text-sm">{s.plan?.name || '\u2014'}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {s.plan && s.plan.monthlyPrice > 0
                            ? `$${s.plan.monthlyPrice.toFixed(2)}/mo`
                            : 'Free'}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <SubStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                        {formatRelativeTime(s.startedAt)}
                      </TableCell>
                      <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                        {s.expiresAt
                          ? formatRelativeTime(s.expiresAt)
                          : 'Lifetime'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => extend(s, 30)}
                            >
                              <CalendarPlus className="h-3.5 w-3.5" /> Extend 30
                              days
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => changePlan(s)}>
                              <CreditCard className="h-3.5 w-3.5" /> Change plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={s.status === 'cancelled'}
                              onClick={() => cancel(s)}
                            >
                              <Ban className="h-3.5 w-3.5" /> Cancel
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !busy && setDialogOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign subscription</DialogTitle>
            <DialogDescription>
              Grant a plan to a user. Leave expiry blank for lifetime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="User">
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by email or name&hellip;"
                className={INPUT_CLASS}
              />
              <div
                className={`surface-3 mt-1.5 max-h-44 overflow-y-auto rounded-md ${SCROLLBAR_CLASS}`}
              >
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-muted-foreground">
                    No users.
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setUserId(u.id)
                        setUserQuery(u.email)
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-surface-2 ${
                        userId === u.id ? 'bg-brand/10 text-brand' : ''
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-medium">{u.email}</span>
                        {u.displayName && (
                          <span className="text-muted-foreground">
                            {' '}
                            &mdash; {u.displayName}
                          </span>
                        )}
                      </span>
                      {userId === u.id && (
                        <Check className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </Field>
            <Field label="Plan">
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{' '}
                      {p.monthlyPrice > 0
                        ? `($${p.monthlyPrice.toFixed(2)}/mo)`
                        : '(Free)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expires at (optional, blank = lifetime)">
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={assign}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'active')
    return (
      <span className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        {status}
      </span>
    )
  if (s === 'cancelled')
    return (
      <span className="inline-flex items-center rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        {status}
      </span>
    )
  if (s === 'expired')
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {status}
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {status}
    </span>
  )
}

/* ---------------- Usage ---------------- */

function UsageTab() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [planMap, setPlanMap] = useState<Map<string, Plan>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      api.admin.listUsage().catch((err) => {
        toast.error(
          err instanceof ApiError ? err.message : 'Failed to load usage.',
        )
        return [] as UsageRow[]
      }),
      api.admin.listPlans().catch(() => [] as Plan[]),
    ])
      .then(([u, plans]) => {
        if (!active) return
        setRows(u)
        const m = new Map<string, Plan>()
        for (const p of plans) m.set(p.id, p)
        setPlanMap(m)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.usage.storageBytes - a.usage.storageBytes),
    [rows],
  )

  const kpis = useMemo(() => {
    const totalStorage = rows.reduce(
      (s, r) => s + r.usage.storageBytes,
      0,
    )
    const activeUsers = rows.filter((r) => r.user.status === 'active').length
    const subscribers = rows.filter(
      (r) => r.subscription && r.subscription.status === 'active',
    ).length
    const revenue = rows.reduce((s, r) => {
      if (r.subscription && r.subscription.status === 'active') {
        return s + (planMap.get(r.subscription.plan.id)?.monthlyPrice || 0)
      }
      return s
    }, 0)
    return { totalStorage, activeUsers, subscribers, revenue }
  }, [rows, planMap])

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div>
          <p className="font-mono text-xs text-brand">
            <span className="text-muted-foreground">{'>'}</span> sudo usage
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Usage Analytics
          </h2>
        </div>
      </Reveal>

      <StaggerGroup
        stagger={0.06}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Total storage"
            value={kpis.totalStorage}
            format={(n) => formatBytes(n)}
            icon={<Database className="h-4 w-4" />}
            accent
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Active users"
            value={kpis.activeUsers}
            icon={<UsersIcon className="h-4 w-4" />}
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Subscribers"
            value={kpis.subscribers}
            icon={<CreditCard className="h-4 w-4" />}
          />
        </Reveal>
        <Reveal variant={scaleIn}>
          <KpiCard
            label="Monthly revenue"
            value={kpis.revenue}
            format={(n) => `$${n.toFixed(2)}`}
            icon={<BarChart3 className="h-4 w-4" />}
            accent
          />
        </Reveal>
      </StaggerGroup>

      <Reveal variant={fadeUp} delay={0.05}>
        <div
          className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}
        >
          <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-2">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Plan
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Storage
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pastes
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Files
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    This month
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Views
                  </TableHead>
                </TableRow>
              </TableHeader>
              <motion.tbody
                variants={staggerContainer(0.04)}
                initial="hidden"
                animate="show"
              >
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading usage&hellip;
                    </TableCell>
                  </TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No usage data.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((r) => {
                    const plan = r.subscription?.plan
                    const planMeta = plan ? planMap.get(plan.id) : undefined
                    const maxStorage =
                      plan?.maxStorageBytes || planMeta?.maxStorageBytes || 0
                    const pct =
                      maxStorage > 0
                        ? Math.min(
                            100,
                            (r.usage.storageBytes / maxStorage) * 100,
                          )
                        : 0
                    const over =
                      maxStorage > 0 && r.usage.storageBytes > maxStorage
                    const maxPastes = planMeta?.maxPastesPerMonth || 0
                    return (
                      <motion.tr
                        key={r.user.id}
                        variants={fadeUp}
                        className="border-border border-b transition-colors hover:bg-surface-3"
                      >
                        <TableCell className="px-4 py-3">
                          <p className="text-sm font-medium">
                            {r.user.displayName || r.user.email}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.user.email}
                          </p>
                          <div className="mt-1">
                            <RoleBadge
                              role={r.user.role as SafeUser['role']}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="text-sm">
                            {plan?.name || 'Free'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono">
                                {formatBytes(r.usage.storageBytes)}
                              </span>
                              {maxStorage > 0 && (
                                <span className="font-mono text-muted-foreground">
                                  / {formatBytes(maxStorage)}
                                </span>
                              )}
                            </div>
                            {maxStorage > 0 && (
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    over ? 'bg-destructive' : 'bg-brand'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {r.usage.totalPastes}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {r.usage.fileCount}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {r.usage.monthPasteCount}
                          {maxPastes > 0 ? ` / ${maxPastes}` : ''}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {r.usage.totalViews}
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
    </div>
  )
}
