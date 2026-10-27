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
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  FileJson,
  FileText,
  Flag,
  Flame,
  Globe,
  HardDrive,
  Key,
  Loader2,
  Lock,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
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
import { invalidateSettings } from '@/hooks/use-public-settings'

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

/** Format a Date into a value usable by `<input type="datetime-local">`. */
function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
      value: 'ads',
      label: 'Ads',
      icon: <Megaphone className="h-3.5 w-3.5" />,
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
      value: 'payments',
      label: 'Payments',
      icon: <Receipt className="h-3.5 w-3.5" />,
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
      value: 'api',
      label: 'API',
      icon: <Code2 className="h-3.5 w-3.5" />,
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
          <TabsContent value="ads" className="mt-0">
            <AdsTab />
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
          <TabsContent value="payments" className="mt-0">
            <PaymentsTab />
          </TabsContent>
          <TabsContent value="usage" className="mt-0">
            <UsageTab />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <SettingsTab />
          </TabsContent>
          <TabsContent value="api" className="mt-0">
            <ApiSettingsTab />
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
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)

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
          <Button
            onClick={() => {
              setEditingUser(null)
              setUserDialogOpen(true)
            }}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add User
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
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(u)
                                  setUserDialogOpen(true)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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

      {/* Create / Edit user dialog */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        editingUser={editingUser}
        onSaved={fetchUsers}
      />
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        <Shield className="h-2.5 w-2.5" /> admin
      </span>
    )
  if (role === 'moderator')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
        <Shield className="h-2.5 w-2.5" /> moderator
      </span>
    )
  if (role === 'user')
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        user
      </span>
    )
  // Custom role
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-2/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-2">
      <Shield className="h-2.5 w-2.5" /> {role}
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

type PaymentRow = {
  id: string
  userId: string
  user: { email: string; displayName: string | null } | null
  planId: string
  plan: { name: string; monthlyPrice: number } | null
  amount: number
  currency: string
  status: string
  method: string
  txnId: string | null
  invoiceNumber: string | null
  notes: string | null
  createdAt: string
}

type InvoiceRow = {
  id: string
  number: string
  paymentId: string
  userId: string
  user: { email: string; displayName: string | null } | null
  amount: number
  currency: string
  planName: string
  periodStart: string
  periodEnd: string | null
  status: string
  createdAt: string
}

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.admin
      .getSettings()
      .then((rows) => {
        if (!active) return
        const s = (rows[0] as Settings | undefined) ?? ({} as Settings)
        // Ensure socialLinks is an object so we can edit keys safely.
        if (!s.socialLinks || typeof s.socialLinks !== 'object') {
          s.socialLinks = {}
        }
        setSettings(s)
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

  function setSocialField(key: string, value: string) {
    setSettings((cur) => {
      if (!cur) return cur
      const existing =
        cur.socialLinks && typeof cur.socialLinks === 'object'
          ? (cur.socialLinks as Record<string, string>)
          : {}
      return { ...cur, socialLinks: { ...existing, [key]: value } }
    })
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      await api.admin.updateSettings(settings as Record<string, unknown>)
      invalidateSettings() // Clear the public settings cache so header/footer update
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
      ? Math.max(1, Math.round((settings.maxFileSizeBytes as number) / (1024 * 1024)))
      : 10

  const socialLinks =
    settings.socialLinks && typeof settings.socialLinks === 'object'
      ? (settings.socialLinks as Record<string, string>)
      : {}

  return (
    <Reveal variant={fadeUp}>
      <div className="surface rounded-2xl p-6">
        {/* Branding */}
        <SectionHeader>Branding</SectionHeader>
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
          <Field label="Logo URL">
            <Input
              value={String(settings.logoUrl ?? '')}
              onChange={(e) => setField('logoUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="/logo.svg"
            />
            {settings.logoUrl ? (
              <img
                src={String(settings.logoUrl)}
                alt="Logo preview"
                className="mt-2 h-10 w-10 rounded-md border border-border bg-surface-3 object-contain p-1"
              />
            ) : null}
          </Field>
          <Field label="Favicon URL">
            <Input
              value={String(settings.faviconUrl ?? '')}
              onChange={(e) => setField('faviconUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="/favicon.ico"
            />
            {settings.faviconUrl ? (
              <img
                src={String(settings.faviconUrl)}
                alt="Favicon preview"
                className="mt-2 h-8 w-8 rounded border border-border bg-surface-3 object-contain p-1"
              />
            ) : null}
          </Field>
        </div>

        <Divider />

        {/* SEO */}
        <SectionHeader>SEO</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Meta title template">
            <Input
              value={String(settings.metaTitleTemplate ?? '')}
              onChange={(e) => setField('metaTitleTemplate', e.target.value)}
              className={INPUT_CLASS}
              placeholder="{title} — PasteShare"
            />
          </Field>
          <Field label="Canonical URL">
            <Input
              value={String(settings.canonicalUrl ?? '')}
              onChange={(e) => setField('canonicalUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="Meta description template" full>
            <Textarea
              value={String(settings.metaDescriptionTemplate ?? '')}
              onChange={(e) => setField('metaDescriptionTemplate', e.target.value)}
              className={`${INPUT_CLASS} min-h-[60px]`}
              placeholder="A code & file sharing platform."
            />
          </Field>
          <Field label="Meta keywords">
            <Input
              value={String(settings.metaKeywords ?? '')}
              onChange={(e) => setField('metaKeywords', e.target.value)}
              className={INPUT_CLASS}
              placeholder="pastebin, code share, syntax highlighting"
            />
          </Field>
          <Field label="OG type">
            <Input
              value={String(settings.ogType ?? '')}
              onChange={(e) => setField('ogType', e.target.value)}
              className={INPUT_CLASS}
              placeholder="website"
            />
          </Field>
          <Field label="OG image URL">
            <Input
              value={String(settings.ogImage ?? '')}
              onChange={(e) => setField('ogImage', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://example.com/og.png"
            />
            {settings.ogImage ? (
              <img
                src={String(settings.ogImage)}
                alt="OG preview"
                className="mt-2 h-16 w-32 rounded border border-border bg-surface-3 object-cover"
              />
            ) : null}
          </Field>
          <Field label="Twitter card">
            <Select
              value={String(settings.twitterCard ?? 'summary')}
              onValueChange={(v) => setField('twitterCard', v)}
            >
              <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">summary</SelectItem>
                <SelectItem value="summary_large_image">
                  summary_large_image
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Twitter site (@username)">
            <Input
              value={String(settings.twitterSite ?? '')}
              onChange={(e) => setField('twitterSite', e.target.value)}
              className={INPUT_CLASS}
              placeholder="@PasteShare"
            />
          </Field>
        </div>

        <Divider />

        {/* Verification & Analytics */}
        <SectionHeader>Verification &amp; Analytics</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google site verification">
            <Input
              value={String(settings.googleSiteVerification ?? '')}
              onChange={(e) => setField('googleSiteVerification', e.target.value)}
              className={INPUT_CLASS}
              placeholder="meta tag content"
            />
          </Field>
          <Field label="Google Analytics ID">
            <Input
              value={String(settings.googleAnalyticsId ?? '')}
              onChange={(e) => setField('googleAnalyticsId', e.target.value)}
              className={INPUT_CLASS}
              placeholder="G-XXXXXXXX"
            />
          </Field>
          <Field label="Google Search Console URL">
            <Input
              value={String(settings.googleSearchConsoleUrl ?? '')}
              onChange={(e) => setField('googleSearchConsoleUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://search.google.com/…"
            />
          </Field>
          <Field label="Bing site verification">
            <Input
              value={String(settings.bingSiteVerification ?? '')}
              onChange={(e) => setField('bingSiteVerification', e.target.value)}
              className={INPUT_CLASS}
              placeholder="meta tag content"
            />
          </Field>
        </div>

        <Divider />

        {/* Captcha */}
        <SectionHeader>Captcha</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Captcha enabled">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.captchaEnabled)}
                onCheckedChange={(c) => setField('captchaEnabled', c)}
              />
              <span className="text-xs text-muted-foreground">
                Require captcha on public forms
              </span>
            </div>
          </Field>
          <Field label="Captcha provider">
            <Select
              value={String(settings.captchaProvider ?? 'none')}
              onValueChange={(v) => setField('captchaProvider', v)}
            >
              <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="recaptcha">reCAPTCHA</SelectItem>
                <SelectItem value="turnstile">Turnstile</SelectItem>
                <SelectItem value="hcaptcha">hCaptcha</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Site key">
            <Input
              value={String(settings.captchaSiteKey ?? '')}
              onChange={(e) => setField('captchaSiteKey', e.target.value)}
              className={INPUT_CLASS}
              placeholder="public site key"
            />
          </Field>
          <Field label="Secret key">
            <Input
              type="password"
              value={String(settings.captchaSecretKey ?? '')}
              onChange={(e) => setField('captchaSecretKey', e.target.value)}
              className={INPUT_CLASS}
              placeholder="secret key"
            />
          </Field>
        </div>

        <Divider />

        {/* Ads Settings */}
        <SectionHeader>Ads Settings</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ads enabled">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.adsEnabled)}
                onCheckedChange={(c) => setField('adsEnabled', c)}
              />
              <span className="text-xs text-muted-foreground">
                Serve ads on public pages
              </span>
            </div>
          </Field>
          <Field label="AdSense client">
            <Input
              value={String(settings.adsenseClient ?? '')}
              onChange={(e) => setField('adsenseClient', e.target.value)}
              className={INPUT_CLASS}
              placeholder="ca-pub-XXXXXXXX"
            />
          </Field>
        </div>

        <Divider />

        {/* Performance */}
        <SectionHeader>Performance</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CDN enabled">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.cdnEnabled)}
                onCheckedChange={(c) => setField('cdnEnabled', c)}
              />
              <span className="text-xs text-muted-foreground">
                Serve static assets from CDN
              </span>
            </div>
          </Field>
          <Field label="Gzip enabled">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(settings.enableGzip)}
                onCheckedChange={(c) => setField('enableGzip', c)}
              />
              <span className="text-xs text-muted-foreground">
                Compress responses
              </span>
            </div>
          </Field>
          <Field label="CDN URL">
            <Input
              value={String(settings.cdnUrl ?? '')}
              onChange={(e) => setField('cdnUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://cdn.example.com"
            />
          </Field>
          <Field label="Cache TTL (seconds)">
            <Input
              type="number"
              min={0}
              value={
                typeof settings.cacheTtl === 'number'
                  ? Number(settings.cacheTtl)
                  : 3600
              }
              onChange={(e) =>
                setField('cacheTtl', Number(e.target.value || 0))
              }
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Divider />

        {/* Social Links */}
        <SectionHeader>Social Links</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Twitter">
            <Input
              value={String(socialLinks.twitter ?? '')}
              onChange={(e) => setSocialField('twitter', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://twitter.com/PasteShare"
            />
          </Field>
          <Field label="GitHub">
            <Input
              value={String(socialLinks.github ?? '')}
              onChange={(e) => setSocialField('github', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://github.com/PasteShare"
            />
          </Field>
          <Field label="Discord">
            <Input
              value={String(socialLinks.discord ?? '')}
              onChange={(e) => setSocialField('discord', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://discord.gg/…"
            />
          </Field>
          <Field label="Website">
            <Input
              value={String(socialLinks.website ?? '')}
              onChange={(e) => setSocialField('website', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://pasteshare.app"
            />
          </Field>
        </div>

        <Divider />

        {/* Storage & Limits */}
        <SectionHeader>Storage &amp; Limits</SectionHeader>
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

        {/* Robots & Sitemap */}
        <SectionHeader>Robots &amp; Sitemap</SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sitemap enabled">
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
          <Field label="robots.txt" full>
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
  full,
}: {
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <div className={`space-y-1.5 ${full ? 'sm:col-span-2' : ''}`}>
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
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const PAGE_SIZE = 20

  async function fetchAudit() {
    setLoading(true)
    try {
      const r = await api.admin.listAudit(100)
      setRows(r)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load audit log.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAudit()
  }, [])

  // Reset to page 1 whenever the query changes.
  useEffect(() => {
    setPage(1)
  }, [query])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.targetId.toLowerCase().includes(q) ||
        (r.adminEmail || '').toLowerCase().includes(q),
    )
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  function exportCsv() {
    const headers = [
      'time',
      'admin',
      'action',
      'target_type',
      'target_id',
      'metadata',
    ]
    const esc = (s: string) => {
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }
    const lines = [headers.join(',')]
    for (const r of filtered) {
      let meta = ''
      if (r.metadata !== null && r.metadata !== undefined) {
        try {
          meta = typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)
        } catch {
          meta = String(r.metadata)
        }
      }
      lines.push(
        [
          esc(r.createdAt),
          esc(r.adminEmail || 'system'),
          esc(r.action),
          esc(r.targetType),
          esc(r.targetId),
          esc(meta),
        ].join(','),
      )
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} entries`)
  }

  async function doClear() {
    setBusy(true)
    try {
      await api.admin.clearAudit()
      toast.success('Audit log cleared')
      setClearOpen(false)
      await fetchAudit()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Clear failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brand">
              <span className="text-muted-foreground">{'>'}</span> sudo audit
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Audit Log
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[11px]"
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] text-destructive hover:text-destructive"
              onClick={() => setClearOpen(true)}
              disabled={loading || rows.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear All
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal variant={fadeUp} delay={0.04}>
        <div className="surface rounded-xl p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by action, target ID, or admin email…"
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <p className="font-mono mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {loading
              ? 'Loading…'
              : `${filtered.length} of ${rows.length} entries · page ${safePage}/${totalPages}`}
          </p>
        </div>
      </Reveal>

      <Reveal variant={fadeUp} delay={0.05}>
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
                key={`page-${safePage}`}
                variants={staggerContainer(0.02)}
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
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No audit entries match.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((a) => (
                    <motion.tr
                      key={a.id}
                      variants={fadeUp}
                      className="border-border border-b transition-colors hover:bg-surface-3"
                    >
                      <TableCell className="font-mono whitespace-nowrap px-4 py-3 text-[11px] text-muted-foreground">
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
                        <span className="block max-w-[140px] truncate" title={a.targetId}>
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

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2 px-4 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Page {safePage} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="font-mono px-2 text-[11px] text-foreground">
                {safePage}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      <AlertDialog
        open={clearOpen}
        onOpenChange={(o) => !o && !busy && setClearOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all audit logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every audit entry. The clear action
              itself will be recorded as a new entry. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={doClear}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Clear all'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const lower = action.toLowerCase()
  if (lower.includes('delete') || lower.includes('clear'))
    return (
      <span className="inline-flex items-center rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        {action}
      </span>
    )
  if (lower.includes('ban') || lower.includes('suspend') || lower.includes('cancel'))
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
        {action}
      </span>
    )
  if (lower.includes('update') || lower.includes('edit') || lower.includes('set') || lower.includes('assign') || lower.includes('extend') || lower.includes('change'))
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
  const entries = useMemo<[string, string][]>(() => {
    if (data === null || data === undefined) return []
    if (typeof data === 'string') {
      const trimmed = data.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return Object.entries(parsed as Record<string, unknown>).map(
              ([k, v]) => [
                k,
                typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v),
              ],
            )
          }
          return [['value', JSON.stringify(parsed)]]
        } catch {
          // fall through
        }
      }
      return [['value', data]]
    }
    if (Array.isArray(data)) {
      return [['value', JSON.stringify(data)]]
    }
    if (typeof data === 'object') {
      return Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v),
      ])
    }
    return [['value', String(data)]]
  }, [data])

  if (entries.length === 0)
    return <span className="text-[11px] text-muted-foreground">—</span>

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Eye className="h-3 w-3" /> View ({entries.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="surface-2 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4 text-brand" /> Metadata
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <tbody>
                {entries.map(([k, v], i) => (
                  <tr key={k} className={i % 2 === 0 ? 'bg-surface-3/50' : ''}>
                    <td className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground align-top whitespace-nowrap">
                      {k}
                    </td>
                    <td className="border-b border-border px-3 py-2 font-mono text-xs text-foreground break-all">
                      {v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ---------------- Ads ---------------- */

type Ad = {
  id: string
  name: string
  slot: string
  adType: string
  content: string
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
  impressions: number
  clicks: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

type AdForm = {
  name: string
  slot: string
  adType: string
  content: string
  imageUrl: string
  linkUrl: string
  isActive: boolean
  startsAt: string
  endsAt: string
}

const AD_SLOTS: { value: string; label: string }[] = [
  { value: 'header', label: 'Header' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'footer', label: 'Footer' },
  { value: 'between-cards', label: 'Between Cards' },
  { value: 'paste-top', label: 'Paste Top' },
  { value: 'paste-bottom', label: 'Paste Bottom' },
]

const AD_TYPES: { value: string; label: string }[] = [
  { value: 'html', label: 'HTML' },
  { value: 'image', label: 'Image' },
  { value: 'adsense', label: 'AdSense' },
  { value: 'custom', label: 'Custom' },
]

function emptyAdForm(): AdForm {
  return {
    name: '',
    slot: 'sidebar',
    adType: 'html',
    content: '',
    imageUrl: '',
    linkUrl: '',
    isActive: true,
    startsAt: '',
    endsAt: '',
  }
}

function isoFromLocal(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function localFromIso(v: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return toLocalDatetime(d)
}

function AdsTab() {
  const [rows, setRows] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Ad | null>(null)
  const [form, setForm] = useState<AdForm>(emptyAdForm())
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Ad | null>(null)

  async function fetchAds() {
    setLoading(true)
    try {
      const r = await api.admin.listAds()
      setRows(
        [...r].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load ads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAds()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyAdForm())
    setDialogOpen(true)
  }

  function openEdit(ad: Ad) {
    setEditing(ad)
    setForm({
      name: ad.name,
      slot: ad.slot,
      adType: ad.adType,
      content: ad.content,
      imageUrl: ad.imageUrl || '',
      linkUrl: ad.linkUrl || '',
      isActive: ad.isActive,
      startsAt: localFromIso(ad.startsAt),
      endsAt: localFromIso(ad.endsAt),
    })
    setDialogOpen(true)
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
        slot: form.slot,
        adType: form.adType,
        content: form.content,
        imageUrl: form.imageUrl.trim() || null,
        linkUrl: form.linkUrl.trim() || null,
        isActive: form.isActive,
        startsAt: isoFromLocal(form.startsAt),
        endsAt: isoFromLocal(form.endsAt),
      }
      if (editing) {
        await api.admin.updateAd(editing.id, body)
        toast.success('Ad updated')
      } else {
        await api.admin.createAd(body)
        toast.success('Ad created')
      }
      setDialogOpen(false)
      fetchAds()
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
      await api.admin.deleteAd(deleteTarget.id)
      toast.success('Ad deleted')
      setDeleteTarget(null)
      fetchAds()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  const activeCount = rows.filter((r) => r.isActive).length

  return (
    <div className="space-y-4">
      <Reveal variant={fadeUp}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-brand">
              <span className="text-muted-foreground">{'>'}</span> sudo ads
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Advertising
            </h2>
          </div>
          <Button
            onClick={openCreate}
            className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> Create Ad
          </Button>
        </div>
      </Reveal>

      {/* KPI cards */}
      <Reveal variant={fadeUp} delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total Impressions"
            value={totalImpressions}
            icon={<Eye className="h-4 w-4" />}
          />
          <KpiCard
            label="Total Clicks"
            value={totalClicks}
            icon={<Megaphone className="h-4 w-4" />}
          />
          <KpiCard
            label="Active Ads"
            value={activeCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      </Reveal>

      {/* Table */}
      <Reveal variant={fadeUp} delay={0.1}>
        <div className={`surface overflow-hidden rounded-xl ${SCROLLBAR_CLASS}`}>
          <div className={`max-h-[60vh] overflow-y-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-2">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Slot
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Impr.
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Clicks
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Period
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
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading ads…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No ads configured. Click &ldquo;Create Ad&rdquo; to add
                      one.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((ad) => (
                    <motion.tr
                      key={ad.id}
                      variants={fadeUp}
                      className="border-border border-b transition-colors hover:bg-surface-3"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {ad.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {ad.id.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-xs text-foreground">
                          {ad.slot}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {ad.adType}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            ad.isActive
                              ? 'bg-brand/15 text-brand'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {ad.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-xs tabular-nums">
                          {ad.impressions.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-xs tabular-nums">
                          {ad.clicks.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="font-mono text-[10px] leading-tight text-muted-foreground">
                          <div>
                            {ad.startsAt
                              ? formatDate(ad.startsAt)
                              : '\u2014'}
                          </div>
                          <div className="text-muted-foreground/60">
                            to {ad.endsAt ? formatDate(ad.endsAt) : '\u2014'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openEdit(ad)}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(ad)}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </motion.tbody>
            </Table>
          </div>
        </div>
      </Reveal>

      {/* Create / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !busy && setDialogOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit ad' : 'Create ad'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update ${editing.name}`
                : 'Configure a new sponsored slot.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, name: e.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="Summer sale banner"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slot">
                <Select
                  value={form.slot}
                  onValueChange={(v) =>
                    setForm((cur) => ({ ...cur, slot: v }))
                  }
                >
                  <SelectTrigger className={INPUT_CLASS}>
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_SLOTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ad type">
                <Select
                  value={form.adType}
                  onValueChange={(v) =>
                    setForm((cur) => ({ ...cur, adType: v }))
                  }
                >
                  <SelectTrigger className={INPUT_CLASS}>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label={
                form.adType === 'image'
                  ? 'Content (ignored for image type)'
                  : form.adType === 'adsense'
                    ? 'AdSense code (ins + script)'
                    : 'Content (HTML markup)'
              }
            >
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, content: e.target.value }))
                }
                rows={6}
                className={`${INPUT_CLASS} font-mono text-xs`}
                placeholder={
                  form.adType === 'adsense'
                    ? '<ins class="adsbygoogle" …></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({})</script>'
                    : '<div class="banner">…</div>'
                }
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Image URL">
                <Input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, imageUrl: e.target.value }))
                  }
                  className={`${INPUT_CLASS} font-mono text-xs`}
                  placeholder="https://…/banner.png"
                />
              </Field>
              <Field label="Link URL">
                <Input
                  value={form.linkUrl}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, linkUrl: e.target.value }))
                  }
                  className={`${INPUT_CLASS} font-mono text-xs`}
                  placeholder="https://advertiser.example"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts at">
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, startsAt: e.target.value }))
                  }
                  className={`${INPUT_CLASS} font-mono text-xs`}
                />
              </Field>
              <Field label="Ends at">
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, endsAt: e.target.value }))
                  }
                  className={`${INPUT_CLASS} font-mono text-xs`}
                />
              </Field>
            </div>

            <label className="surface-3 flex items-center justify-between gap-2 rounded-md p-3 text-xs">
              <span className="text-muted-foreground">Active</span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm((cur) => ({ ...cur, isActive: v }))
                }
              />
            </label>
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
              {editing ? 'Save changes' : 'Create ad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !busy && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ad?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-mono text-foreground">
                {deleteTarget?.name}
              </span>
              . Impression and click statistics will be lost.
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

  // Change Plan dialog
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [changePlanTarget, setChangePlanTarget] = useState<Subscription | null>(null)
  const [changePlanId, setChangePlanId] = useState('')
  const [changePlanExpiresAt, setChangePlanExpiresAt] = useState('')
  const [changePlans, setChangePlans] = useState<Plan[]>([])

  // Extend dialog
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendTarget, setExtendTarget] = useState<Subscription | null>(null)
  const [extendExpiresAt, setExtendExpiresAt] = useState('')

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
      // Hide admin users from plan assignment.
      const nonAdmins = u.filter((usr) => usr.role !== 'admin')
      // Hide any special "Admin" plan from the dropdown.
      const regularPlans = p.filter(
        (plan) => plan.name.toLowerCase() !== 'admin',
      )
      setUsers(nonAdmins)
      setPlans([...regularPlans].sort((a, b) => a.sortOrder - b.sortOrder))
      setUserId('')
      setPlanId(regularPlans[0]?.id || '')
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

  async function cancel(sub: Subscription) {
    try {
      await api.admin.cancelSubscription(sub.id)
      toast.success('Subscription cancelled')
      fetchSubs()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cancel failed.')
    }
  }

  async function openChangePlan(sub: Subscription) {
    setChangePlanTarget(sub)
    setChangePlanId(sub.planId)
    setChangePlanExpiresAt('')
    try {
      const all = await api.admin.listPlans()
      // Only show active, non-Admin plans.
      const active = all.filter(
        (p) => p.isActive && p.name.toLowerCase() !== 'admin',
      )
      const sorted = [...active].sort((a, b) => a.sortOrder - b.sortOrder)
      setChangePlans(sorted)
      if (!sorted.find((p) => p.id === sub.planId)) {
        setChangePlanId(sorted[0]?.id || '')
      }
      setChangePlanOpen(true)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load plans.')
    }
  }

  async function saveChangePlan() {
    if (!changePlanTarget) return
    if (!changePlanId) {
      toast.error('Pick a plan.')
      return
    }
    setBusy(true)
    try {
      await api.admin.updateSubscription(changePlanTarget.id, {
        planId: changePlanId,
        status: 'active',
        expiresAt: changePlanExpiresAt
          ? new Date(changePlanExpiresAt).toISOString()
          : null,
      })
      toast.success('Plan changed')
      setChangePlanOpen(false)
      fetchSubs()
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Change plan failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  function openExtend(sub: Subscription) {
    setExtendTarget(sub)
    // Pre-fill with current expiry, or +30 days from now if null.
    const base = sub.expiresAt
      ? new Date(sub.expiresAt)
      : new Date(Date.now() + 30 * 86400000)
    setExtendExpiresAt(toLocalDatetime(base))
    setExtendOpen(true)
  }

  function quickExtend(days: number | 'lifetime') {
    if (days === 'lifetime') {
      setExtendExpiresAt('')
      return
    }
    const now = Date.now()
    const curMs = extendTarget?.expiresAt
      ? new Date(extendTarget.expiresAt).getTime()
      : now
    const baseMs = curMs > now ? curMs : now
    const next = new Date(baseMs + days * 86400000)
    setExtendExpiresAt(toLocalDatetime(next))
  }

  async function saveExtend() {
    if (!extendTarget) return
    setBusy(true)
    try {
      await api.admin.updateSubscription(extendTarget.id, {
        status: 'active',
        expiresAt: extendExpiresAt
          ? new Date(extendExpiresAt).toISOString()
          : null,
      })
      toast.success('Subscription extended')
      setExtendOpen(false)
      fetchSubs()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Extend failed.')
    } finally {
      setBusy(false)
    }
  }

  const filteredUsers = useMemo(() => {
    // Admin users are already excluded in openAssign; double-check here too.
    const nonAdmins = users.filter((u) => u.role !== 'admin')
    if (!userQuery.trim()) return nonAdmins.slice(0, 50)
    const q = userQuery.toLowerCase()
    return nonAdmins
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
                            <DropdownMenuItem onClick={() => openExtend(s)}>
                              <CalendarPlus className="h-3.5 w-3.5" /> Extend
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openChangePlan(s)}>
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

      {/* Assign dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !busy && setDialogOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign subscription</DialogTitle>
            <DialogDescription>
              Grant a plan to a non-admin user. Leave expiry blank for lifetime.
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

      {/* Change Plan dialog */}
      <Dialog
        open={changePlanOpen}
        onOpenChange={(o) => !busy && setChangePlanOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              {changePlanTarget && (
                <>
                  Update plan for{' '}
                  <span className="font-mono text-foreground">
                    {changePlanTarget.user?.email || 'unknown'}
                  </span>
                  . Leave expiry blank for lifetime.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Plan">
              <Select value={changePlanId} onValueChange={setChangePlanId}>
                <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {changePlans.map((p) => (
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
                value={changePlanExpiresAt}
                onChange={(e) => setChangePlanExpiresAt(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setChangePlanOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={saveChangePlan}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend dialog */}
      <Dialog
        open={extendOpen}
        onOpenChange={(o) => !busy && setExtendOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extend subscription</DialogTitle>
            <DialogDescription>
              {extendTarget && (
                <>
                  Extend expiry for{' '}
                  <span className="font-mono text-foreground">
                    {extendTarget.user?.email || 'unknown'}
                  </span>
                  . Pick a date or use a quick preset.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Quick presets">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+30 days', days: 30 as const },
                  { label: '+90 days', days: 90 as const },
                  { label: '+1 year', days: 365 as const },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => quickExtend(opt.days)}
                    className="font-mono rounded-md border border-border bg-surface-3 px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => quickExtend('lifetime')}
                  className={`font-mono rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                    extendExpiresAt === ''
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-surface-3 hover:bg-surface-2 hover:text-foreground'
                  }`}
                >
                  Lifetime
                </button>
              </div>
            </Field>
            <Field label="Expires at (blank = lifetime)">
              <Input
                type="datetime-local"
                value={extendExpiresAt}
                onChange={(e) => setExtendExpiresAt(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExtendOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={saveExtend}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="h-3.5 w-3.5" />
              )}
              Extend
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

/* ---------------- Payments ---------------- */

/** Escape a user-supplied string for safe interpolation into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Generate a clean HTML invoice from a payment + invoice record and trigger
 * a browser download as a `.html` file. The user can open it in any browser
 * and print it to PDF if needed (no PDF library required on the client).
 */
function downloadInvoiceHTML(
  invoice: InvoiceRow,
  payment: PaymentRow | undefined,
  user: { email: string; displayName: string | null } | null,
  plan: { name: string; monthlyPrice: number } | null,
) {
  const issued = new Date(invoice.createdAt).toLocaleString()
  const periodStart = new Date(invoice.periodStart).toLocaleDateString()
  const periodEnd = invoice.periodEnd
    ? new Date(invoice.periodEnd).toLocaleDateString()
    : '—'
  const amountStr = `${invoice.currency} ${(invoice.amount ?? 0).toFixed(2)}`
  const customer = user?.email || '—'
  const customerName = user?.displayName || '—'
  const planName = plan?.name || invoice.planName || '—'
  const methodName = payment?.method || '—'
  const txnId = payment?.txnId || '—'
  const status = invoice.status || '—'

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(invoice.number)}</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#18181b;background:#f4f4f5;margin:0;padding:32px;}
  .invoice{max-width:720px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.06);}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #18181b;}
  .brand{font-size:22px;font-weight:700;letter-spacing:-.01em;}
  .brand-sub{font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;margin-bottom:4px;}
  .value{font-size:14px;color:#18181b;}
  .mono{font-family:"SFMono-Regular",Menlo,Consolas,monospace;font-size:13px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
  .section{margin-bottom:28px;}
  .section-title{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;}
  th,td{text-align:left;padding:12px 0;border-bottom:1px solid #e4e4e7;font-size:14px;}
  th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;font-weight:600;}
  td.amount,th.amount{text-align:right;font-family:"SFMono-Regular",Menlo,Consolas,monospace;}
  .total{display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;border-top:2px solid #18181b;margin-top:8px;}
  .total-label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;}
  .total-amount{font-size:22px;font-weight:700;font-family:"SFMono-Regular",Menlo,Consolas,monospace;}
  .badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;background:#18181b;color:#fff;}
  .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;line-height:1.5;}
  @media print{body{background:#fff;padding:0;}.invoice{box-shadow:none;padding:24px;}}
</style>
</head>
<body>
  <div class="invoice">
    <div class="head">
      <div>
        <div class="brand">PasteShare</div>
        <div class="brand-sub">Code &amp; file sharing</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Invoice</div>
        <div class="value mono">${escapeHtml(invoice.number)}</div>
        <div class="label" style="margin-top:12px;">Status</div>
        <span class="badge">${escapeHtml(status)}</span>
      </div>
    </div>

    <div class="grid section">
      <div>
        <div class="label">Billed to</div>
        <div class="value">${escapeHtml(customerName)}</div>
        <div class="value" style="color:#71717a;">${escapeHtml(customer)}</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Issued</div>
        <div class="value">${escapeHtml(issued)}</div>
        <div class="label" style="margin-top:12px;">Billing period</div>
        <div class="value">${escapeHtml(periodStart)} &mdash; ${escapeHtml(periodEnd)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Line items</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(planName)} subscription</td>
            <td class="amount">${escapeHtml(amountStr)}</td>
          </tr>
        </tbody>
      </table>
      <div class="total">
        <span class="total-label">Total due</span>
        <span class="total-amount">${escapeHtml(amountStr)}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Payment</div>
      <div class="grid">
        <div>
          <div class="label">Method</div>
          <div class="value">${escapeHtml(methodName)}</div>
        </div>
        <div style="text-align:right;">
          <div class="label">Transaction ID</div>
          <div class="value mono">${escapeHtml(txnId)}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      This is a computer-generated invoice and does not require a signature.<br>
      For billing questions, contact the PasteShare administrator.
    </div>
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.number || 'invoice'}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function PaymentsTab() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [resending, setResending] = useState<string | null>(null)

  // Create-payment dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('manual')
  const [txnId, setTxnId] = useState('')
  const [status, setStatus] = useState('completed')
  const [busy, setBusy] = useState(false)

  async function fetchPayments() {
    setLoading(true)
    try {
      const [p, i] = await Promise.all([
        api.admin.listPayments(
          statusFilter === 'all' ? undefined : statusFilter,
        ),
        api.admin.listInvoices(),
      ])
      setPayments(p as PaymentRow[])
      setInvoices(i as InvoiceRow[])
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to load payments.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [statusFilter])

  async function openCreate() {
    try {
      const [u, p] = await Promise.all([
        api.admin.listUsers(),
        api.admin.listPlans(),
      ])
      const nonAdmins = u.filter((usr) => usr.role !== 'admin')
      const regularPlans = p
        .filter((plan) => plan.isActive && plan.name.toLowerCase() !== 'admin')
        .sort((a, b) => a.sortOrder - b.sortOrder)
      setUsers(nonAdmins)
      setPlans(regularPlans)
      setUserId('')
      setPlanId(regularPlans[0]?.id || '')
      setAmount(regularPlans[0] ? String(regularPlans[0].monthlyPrice) : '')
      setMethod('manual')
      setTxnId('')
      setStatus('completed')
      setUserQuery('')
      setCreateOpen(true)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to load users/plans.',
      )
    }
  }

  function pickPlan(id: string) {
    setPlanId(id)
    const plan = plans.find((p) => p.id === id)
    if (plan) setAmount(String(plan.monthlyPrice))
  }

  async function createPayment() {
    if (!userId) {
      toast.error('Pick a user.')
      return
    }
    if (!planId) {
      toast.error('Pick a plan.')
      return
    }
    const amt = Number(amount || 0)
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter a valid amount.')
      return
    }
    setBusy(true)
    try {
      await api.admin.createPayment({
        userId,
        planId,
        amount: amt,
        method,
        txnId: txnId || undefined,
        status,
      })
      toast.success('Payment recorded · receipt email queued (check audit log)')
      setCreateOpen(false)
      fetchPayments()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Create failed.')
    } finally {
      setBusy(false)
    }
  }

  async function resendReceipt(p: PaymentRow) {
    setResending(p.id)
    try {
      await api.admin.updatePayment(p.id, { notes: 'receipt_resent' })
      toast.success('Receipt email queued (check audit log)')
      fetchPayments()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Resend failed.')
    } finally {
      setResending(null)
    }
  }

  const invoiceByPayment = useMemo(() => {
    const m = new Map<string, InvoiceRow>()
    for (const inv of invoices) m.set(inv.paymentId, inv)
    return m
  }, [invoices])

  const filteredUsers = useMemo(() => {
    const nonAdmins = users.filter((u) => u.role !== 'admin')
    if (!userQuery.trim()) return nonAdmins.slice(0, 50)
    const q = userQuery.toLowerCase()
    return nonAdmins
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
              <span className="text-muted-foreground">{'>'}</span> sudo payments
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Payments &amp; Invoices
            </h2>
          </div>
          <Button
            onClick={openCreate}
            className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> Record payment
          </Button>
        </div>
      </Reveal>

      <Reveal variant={fadeUp}>
        <div className="flex flex-wrap gap-1.5">
          {['all', 'completed', 'pending', 'failed', 'refunded'].map((s) => (
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
                    Amount
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Method
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Invoice #
                  </TableHead>
                  <TableHead className="font-mono px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Date
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
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                      Loading payments&hellip;
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => {
                    const invoice = invoiceByPayment.get(p.id)
                    return (
                      <motion.tr
                        key={p.id}
                        variants={fadeUp}
                        className="border-border border-b transition-colors hover:bg-surface-3"
                      >
                        <TableCell className="px-4 py-3">
                          <p className="text-sm font-medium">
                            {p.user?.email || 'unknown'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.user?.displayName || '\u2014'}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <p className="text-sm">{p.plan?.name || '\u2014'}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {p.plan && p.plan.monthlyPrice > 0
                              ? `$${p.plan.monthlyPrice.toFixed(2)}/mo`
                              : 'Free'}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-xs">
                          {p.currency} {p.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <PaymentStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                          {p.method}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-[11px]">
                          {p.invoiceNumber || '\u2014'}
                        </TableCell>
                        <TableCell className="font-mono px-4 py-3 text-[11px] text-muted-foreground">
                          {formatRelativeTime(p.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-[11px]"
                              disabled={!invoice}
                              onClick={() => {
                                if (invoice) {
                                  downloadInvoiceHTML(
                                    invoice,
                                    p,
                                    p.user,
                                    p.plan,
                                  )
                                }
                              }}
                              title={
                                invoice
                                  ? 'Download invoice HTML'
                                  : 'No invoice linked'
                              }
                            >
                              <Download className="h-3.5 w-3.5" /> Invoice
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-[11px]"
                              disabled={resending === p.id}
                              onClick={() => resendReceipt(p)}
                              title="Resend receipt email"
                            >
                              {resending === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Resend
                            </Button>
                          </div>
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

      {/* Create-payment dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => !busy && setCreateOpen(o)}
      >
        <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Manually record a payment for a non-admin user. An invoice will
              be auto-generated and a receipt email will be queued (visible in
              the audit log).
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
              <Select value={planId} onValueChange={pickPlan}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Method">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">manual</SelectItem>
                    <SelectItem value="stripe">stripe</SelectItem>
                    <SelectItem value="paypal">paypal</SelectItem>
                    <SelectItem value="razorpay">razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Transaction ID (optional)">
                <Input
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="tx_…"
                />
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className={`${INPUT_CLASS} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">completed</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                    <SelectItem value="refunded">refunded</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={createPayment}
              disabled={busy}
              className="btn-shine bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'completed')
    return (
      <span className="inline-flex items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
        {status}
      </span>
    )
  if (s === 'refunded' || s === 'failed')
    return (
      <span className="inline-flex items-center rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        {status}
      </span>
    )
  if (s === 'pending')
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
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

/* ---------------- User Dialog (Create / Edit) ---------------- */

type UserDialogProps = {
  open: boolean
  onOpenChange: (o: boolean) => void
  editingUser: UserRow | null
  onSaved: () => void
}

function UserDialog({
  open,
  onOpenChange,
  editingUser,
  onSaved,
}: UserDialogProps) {
  const editing = !!editingUser
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [roleId, setRoleId] = useState<string>('')
  const [allRoles, setAllRoles] = useState<{ id: string; name: string; description: string | null; isSystem: boolean }[]>([])
  const [status, setStatus] = useState<
    'active' | 'suspended' | 'banned' | 'pending_verification'
  >('active')
  const [autoVerify, setAutoVerify] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch all RBAC roles when the dialog opens
  useEffect(() => {
    if (!open) return
    api.admin.listRoles().then((roles) => {
      setAllRoles(roles.map((r) => ({ id: r.id, name: r.name, description: r.description, isSystem: r.isSystem })))
    }).catch(() => { /* ignore */ })
  }, [open])

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    if (editingUser) {
      setEmail(editingUser.email)
      setDisplayName(editingUser.displayName ?? '')
      // Find the roleId that matches the user's role name
      setRoleId('') // will be set after roles load
      setStatus(editingUser.status)
      setPassword('')
      setAutoVerify(true)
    } else {
      setEmail('')
      setPassword('')
      setDisplayName('')
      setRoleId('')
      setStatus('active')
      setAutoVerify(true)
    }
  }, [open, editingUser])

  // When roles load, set the roleId from the editing user's role name
  useEffect(() => {
    if (open && editingUser && allRoles.length > 0) {
      const match = allRoles.find((r) => r.name === editingUser.role)
      setRoleId(match ? match.id : '')
    }
  }, [open, editingUser, allRoles])

  async function save() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      toast.error('Email is required.')
      return
    }
    if (!editing && password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (editing && password && password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      if (editing && editingUser) {
        const patch: {
          email: string
          displayName: string
          roleId: string | null
          status: 'active' | 'suspended' | 'banned' | 'pending_verification'
          password?: string
        } = {
          email: trimmedEmail,
          displayName: displayName.trim(),
          roleId: roleId || null,
          status,
        }
        if (password) patch.password = password
        await api.admin.updateUser(editingUser.id, patch)
        toast.success('User updated')
      } else {
        await api.admin.createUser({
          email: trimmedEmail,
          password,
          displayName: displayName.trim() || undefined,
          roleId: roleId || undefined,
          status,
          autoVerify,
        })
        toast.success('User created')
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface-2 max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <Pencil className="h-4 w-4 text-brand" />
            ) : (
              <UserPlus className="h-4 w-4 text-brand" />
            )}
            {editing ? 'Edit user' : 'Create user'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Update details for ${editingUser?.email}`
              : 'Provision a new account. The user can log in immediately.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
              placeholder="user@example.com"
              autoComplete="off"
            />
          </Field>

          <Field label="Display name (optional)">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Ada Lovelace"
              autoComplete="off"
            />
          </Field>

          <Field
            label={
              editing
                ? 'New password (leave blank to keep current)'
                : 'Password'
            }
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
              placeholder={editing ? '••••••••' : 'Min 8 characters'}
              autoComplete="new-password"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role">
              <Select
                value={roleId}
                onValueChange={(v) => setRoleId(v)}
              >
                <SelectTrigger className={INPUT_CLASS}>
                  <SelectValue placeholder={allRoles.length === 0 ? 'Loading roles…' : 'Select role'} />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.isSystem ? ' (system)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(
                    v as
                      | 'active'
                      | 'suspended'
                      | 'banned'
                      | 'pending_verification',
                  )
                }
              >
                <SelectTrigger className={INPUT_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="pending_verification">
                    pending_verification
                  </SelectItem>
                  <SelectItem value="suspended">suspended</SelectItem>
                  <SelectItem value="banned">banned</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!editing && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-3/50 px-3 py-2.5">
              <Checkbox
                checked={autoVerify}
                onCheckedChange={(c) => setAutoVerify(c === true)}
              />
              <span className="text-xs text-muted-foreground">
                Auto-verify email (skip verification flow)
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
            size="sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : editing ? (
              <Save className="h-3.5 w-3.5" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- API Settings ---------------- */

type ApiDocsEndpoint = {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  auth: 'none' | 'optional' | 'required' | 'admin'
  response: string
  body?: Record<string, string>
  query?: Record<string, string>
}

type ApiDocsPayload = {
  baseUrl: string
  auth: { type: string; description: string }
  apiKey: { header: string; description: string }
  responseFormat: { message: string; data: string }
  statusCodes: { code: number; meaning: string }[]
  endpoints: ApiDocsEndpoint[]
}

const METHOD_BADGE_CLASS: Record<ApiDocsEndpoint['method'], string> = {
  PUT: 'bg-brand/15 text-brand',
  POST: 'bg-brand-2/15 text-brand-2',
  GET: 'bg-muted text-muted-foreground',
  PATCH: 'bg-amber-500/15 text-amber-500',
  DELETE: 'bg-destructive/15 text-destructive',
}

const AUTH_BADGE_CLASS: Record<ApiDocsEndpoint['auth'], string> = {
  none: 'bg-muted text-muted-foreground',
  optional: 'bg-amber-500/15 text-amber-500',
  required: 'bg-brand/15 text-brand',
  admin: 'bg-brand-2/15 text-brand-2',
}

const DEFAULT_STATUS_CODES: { code: number; meaning: string }[] = [
  { code: 200, meaning: 'OK — request succeeded' },
  { code: 201, meaning: 'Created — resource created successfully' },
  { code: 400, meaning: 'Bad Request — malformed body or missing field' },
  { code: 401, meaning: 'Unauthorized — authentication required or invalid' },
  { code: 403, meaning: 'Forbidden — authenticated but not allowed' },
  { code: 404, meaning: 'Not Found — resource does not exist' },
  { code: 409, meaning: 'Conflict — duplicate resource' },
  { code: 410, meaning: 'Gone — paste has expired or been burned' },
  { code: 422, meaning: 'Unprocessable Entity — validation error' },
  { code: 429, meaning: 'Too Many Requests — rate limit hit' },
  { code: 500, meaning: 'Internal Server Error' },
]

const RESPONSE_FORMAT_EXAMPLE = `{
  "message": "Paste created",
  "data": [
    { "id": "abc123", "slug": "k3Xy9", "textContent": "hello" }
  ]
}`

function ApiSettingsTab() {
  const me = useAppStore((s) => s.user)!
  const setUser = useAppStore((s) => s.setUser)

  const [apiEnabled, setApiEnabled] = useState(true)
  const [apiRateLimit, setApiRateLimit] = useState(60)
  const [apiRequireAuth, setApiRequireAuth] = useState(true)
  const [apiCorsOrigins, setApiCorsOrigins] = useState('*')
  const [apiWebhookUrl, setApiWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [docs, setDocs] = useState<ApiDocsPayload | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [keyBusy, setKeyBusy] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [codeTab, setCodeTab] = useState('curl')

  useEffect(() => {
    let active = true
    api.admin
      .getSettings()
      .then((rows) => {
        if (!active) return
        const s = (rows[0] ?? {}) as Record<string, unknown>
        setApiEnabled(s.apiEnabled !== false)
        setApiRateLimit(
          typeof s.apiRateLimit === 'number' ? s.apiRateLimit : 60,
        )
        setApiRequireAuth(s.apiRequireAuth !== false)
        setApiCorsOrigins(
          typeof s.apiCorsOrigins === 'string' && s.apiCorsOrigins
            ? s.apiCorsOrigins
            : '*',
        )
        setApiWebhookUrl(
          typeof s.apiWebhookUrl === 'string' ? s.apiWebhookUrl : '',
        )
      })
      .catch((err) => {
        toast.error(
          err instanceof ApiError ? err.message : 'Failed to load API settings.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Fetch the self-documenting API docs (public endpoint).
    fetch('/api/docs')
      .then((r) => r.json())
      .then((env: { data: ApiDocsPayload[] }) => {
        if (active && env.data && env.data[0]) setDocs(env.data[0])
      })
      .catch(() => {
        /* non-fatal — docs panel just stays in default state */
      })

    return () => {
      active = false
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      await api.admin.updateSettings({
        apiEnabled,
        apiRateLimit,
        apiRequireAuth,
        apiCorsOrigins,
        apiWebhookUrl: apiWebhookUrl || null,
      })
      invalidateSettings()
      toast.success('API settings saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateKey(isRevoke: boolean) {
    setKeyBusy(true)
    try {
      const res = await api.admin.updateUser(me.id, { regenerateApiKey: true })
      const updated = res[0]
      if (updated) {
        setUser({ ...me, apiKey: updated.apiKey })
        toast.success(
          isRevoke
            ? 'Previous API key revoked — new key generated.'
            : 'New API key generated.',
        )
        setShowKey(true)
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to rotate API key.',
      )
    } finally {
      setKeyBusy(false)
      setRevokeOpen(false)
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Clipboard unavailable in this context.')
    }
  }

  if (loading) {
    return (
      <div className="surface rounded-2xl p-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    )
  }

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin + '/api' : '/api'
  const apiKey = me.apiKey
  const maskedKey = apiKey ? '•'.repeat(Math.min(apiKey.length, 28)) : ''

  const codeExamples: { value: string; label: string; code: string }[] = [
    {
      value: 'curl',
      label: 'cURL',
      code: `curl -X PUT ${baseUrl}/paste \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey ?? 'YOUR_KEY'}" \\
  -d '{"textContent":"hello"}'`,
    },
    {
      value: 'javascript',
      label: 'JavaScript',
      code: `const res = await fetch('${baseUrl}/paste', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${apiKey ?? 'YOUR_KEY'}',
  },
  body: JSON.stringify({ textContent: 'hello' }),
});
const { data } = await res.json();
console.log(data[0]);`,
    },
    {
      value: 'python',
      label: 'Python',
      code: `import requests

r = requests.put(
    '${baseUrl}/paste',
    json={'textContent': 'hello'},
    headers={'x-api-key': '${apiKey ?? 'YOUR_KEY'}'},
)
print(r.json()['data'][0])`,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Section 1 — API Configuration */}
      <Reveal variant={fadeUp}>
        <div className="surface rounded-xl p-5">
          <SectionHeader>API Configuration</SectionHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API enabled">
              <div className="flex items-center gap-2 pt-1.5">
                <Switch
                  checked={apiEnabled}
                  onCheckedChange={setApiEnabled}
                />
                <span className="text-xs text-muted-foreground">
                  Enable external API access globally
                </span>
              </div>
            </Field>
            <Field label="Rate limit (req / min / key)">
              <Input
                type="number"
                min={1}
                value={apiRateLimit}
                onChange={(e) =>
                  setApiRateLimit(Math.max(1, Number(e.target.value || 0)))
                }
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Require authentication">
              <div className="flex items-center gap-2 pt-1.5">
                <Switch
                  checked={apiRequireAuth}
                  onCheckedChange={setApiRequireAuth}
                />
                <span className="text-xs text-muted-foreground">
                  Require API key or session for all calls
                </span>
              </div>
            </Field>
            <Field label="Webhook URL (optional)">
              <Input
                type="url"
                value={apiWebhookUrl}
                onChange={(e) => setApiWebhookUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://example.com/hooks/paste"
              />
            </Field>
            <Field label="CORS origins (one per line, * for all)" full>
              <Textarea
                value={apiCorsOrigins}
                onChange={(e) => setApiCorsOrigins(e.target.value)}
                className={`${INPUT_CLASS} min-h-[80px] font-mono text-xs`}
                placeholder={'*\nhttps://app.example.com'}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              onClick={save}
              disabled={saving}
              className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save API settings
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Section 2 — API Documentation */}
      <Reveal variant={fadeUp} delay={0.05}>
        <div className="surface rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <SectionHeader>API Documentation</SectionHeader>
            <Button
              onClick={() => copyText(baseUrl, 'Base URL')}
              variant="outline"
              size="sm"
              className="border-border"
            >
              <Copy className="h-3.5 w-3.5" /> Copy base URL
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Response format */}
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Response format
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-surface-3 p-3 font-mono text-xs text-foreground">
{RESPONSE_FORMAT_EXAMPLE}
              </pre>
              {docs && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {docs.responseFormat.message}
                  <br />
                  {docs.responseFormat.data}
                </p>
              )}
            </div>

            {/* Auth methods */}
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Authentication
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
                  <Key className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-foreground">
                      x-api-key header
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Send your API key in the{' '}
                      <code className="font-mono text-foreground">x-api-key</code>{' '}
                      header for non-browser clients.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-3 p-2.5">
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-foreground">
                      Session cookie
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Browsers send the{' '}
                      <code className="font-mono text-foreground">ps_session</code>{' '}
                      cookie automatically (7-day TTL).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Endpoints table */}
          <div className="mt-5">
            <p className="font-mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Endpoints{docs ? ` (${docs.endpoints.length})` : ''}
            </p>
            <div
              className={`overflow-hidden rounded-lg border border-border ${SCROLLBAR_CLASS}`}
            >
              <div className={`max-h-96 overflow-y-auto ${SCROLLBAR_CLASS}`}>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-surface-2">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Method
                      </TableHead>
                      <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Path
                      </TableHead>
                      <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Description
                      </TableHead>
                      <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Auth
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs ? (
                      docs.endpoints.map((e, i) => (
                        <TableRow
                          key={`${e.method}-${e.path}-${i}`}
                          className="border-border"
                        >
                          <TableCell className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_BADGE_CLASS[e.method]}`}
                            >
                              {e.method}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono px-3 py-2 text-xs text-foreground break-all">
                            {e.path}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                            {e.description}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] ${AUTH_BADGE_CLASS[e.auth]}`}
                            >
                              {e.auth}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-3 py-8 text-center text-xs text-muted-foreground"
                        >
                          Loading documentation…
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Status codes */}
          <div className="mt-5">
            <p className="font-mono mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Status codes
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-surface-2">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Code
                    </TableHead>
                    <TableHead className="font-mono px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Meaning
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(docs?.statusCodes ?? DEFAULT_STATUS_CODES).map((s) => (
                    <TableRow key={s.code} className="border-border">
                      <TableCell className="font-mono px-3 py-1.5 text-xs font-bold text-foreground">
                        {s.code}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                        {s.meaning}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Section 3 — API Key Management */}
      <Reveal variant={fadeUp} delay={0.1}>
        <div className="surface rounded-xl p-5">
          <SectionHeader>API Key Management</SectionHeader>
          <p className="mb-3 text-xs text-muted-foreground">
            Use this key in the{' '}
            <code className="font-mono text-foreground">x-api-key</code> header
            for API requests.
          </p>
          <div className="rounded-lg border border-border bg-surface-3 p-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 shrink-0 text-brand" />
              <code className="flex-1 truncate font-mono text-xs text-foreground">
                {apiKey
                  ? showKey
                    ? apiKey
                    : maskedKey
                  : 'No API key — generate one below.'}
              </code>
              {apiKey && (
                <Button
                  onClick={() => setShowKey((s) => !s)}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {apiKey && (
                <Button
                  onClick={() => copyText(apiKey, 'API key')}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Copy key"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => regenerateKey(false)}
              disabled={keyBusy}
              className="btn-shine gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              size="sm"
            >
              {keyBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {apiKey ? 'Generate new key' : 'Generate API key'}
            </Button>
            {apiKey && (
              <Button
                onClick={() => setRevokeOpen(true)}
                disabled={keyBusy}
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Ban className="h-3.5 w-3.5" /> Revoke API key
              </Button>
            )}
          </div>

          <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current key will be invalidated immediately. A fresh key
                  is generated in its place — copy it if you still need API
                  access, or leave it unused to effectively disable API access
                  for this account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={keyBusy}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => regenerateKey(true)}
                  disabled={keyBusy}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {keyBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Revoke &amp; rotate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Reveal>

      {/* Section 4 — Code Examples */}
      <Reveal variant={fadeUp} delay={0.15}>
        <div className="surface rounded-xl p-5">
          <SectionHeader>Code Examples</SectionHeader>
          <Tabs value={codeTab} onValueChange={setCodeTab}>
            <TabsList className="bg-surface-3">
              {codeExamples.map((e) => (
                <TabsTrigger
                  key={e.value}
                  value={e.value}
                  className="font-mono text-[11px] uppercase tracking-wider"
                >
                  {e.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {codeExamples.map((e) => (
              <TabsContent key={e.value} value={e.value} className="mt-3">
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg border border-border bg-surface-3 p-3 pr-10 font-mono text-xs text-foreground">
{e.code}
                  </pre>
                  <Button
                    onClick={() => copyText(e.code, `${e.label} snippet`)}
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1.5 h-7 w-7"
                    title="Copy snippet"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Reveal>
    </div>
  )
}
