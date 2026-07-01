'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  FileCode,
  Upload,
  Lock,
  Flame,
  Clock,
  Globe,
  Link as LinkIcon,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { CodeEditor } from '@/components/editor/code-editor'
import { PasteCard } from '@/components/paste-card'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { LANGUAGES, EXPIRY_OPTIONS, formatBytes } from '@/lib/ui-utils'
import type { SafePaste, SafeUser } from '@/lib/types'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB cap (mirrors server enforcement)

const FEATURE_PILLS = [
  { icon: Sparkles, label: '100+ languages' },
  { icon: Flame, label: 'Burn after read' },
  { icon: Lock, label: 'Password-protected' },
]

const VISIBILITY_OPTIONS: {
  value: 'public' | 'unlisted' | 'private'
  label: string
  icon: typeof Globe
}[] = [
  { value: 'public', label: 'Public', icon: Globe },
  { value: 'unlisted', label: 'Unlisted', icon: LinkIcon },
  { value: 'private', label: 'Private', icon: Lock },
]

// Build a deduped language list — "Auto-detect" (plaintext) first.
const LANGUAGE_OPTIONS: { value: string; label: string }[] = (() => {
  const seen = new Set<string>(['plaintext'])
  const out: { value: string; label: string }[] = [
    { value: 'plaintext', label: 'Auto-detect' },
  ]
  for (const l of LANGUAGES) {
    if (!seen.has(l.value)) {
      out.push(l)
      seen.add(l.value)
    }
  }
  return out
})()

export function HomeView() {
  const { user, goView, goBrowse } = useAppStore()

  // --- shared form state ---
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  // text-only
  const [textContent, setTextContent] = useState('')
  const [language, setLanguage] = useState('plaintext')

  // file-only
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // shared options
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public')
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [burnAfterRead, setBurnAfterRead] = useState(false)
  const [expiryPreset, setExpiryPreset] = useState('never')
  const [expiryCustom, setExpiryCustom] = useState('')

  const [submitting, setSubmitting] = useState(false)

  // recent public pastes strip
  const [recent, setRecent] = useState<SafePaste[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  // Demote private → public if the user logs out while a private visibility is selected.
  useEffect(() => {
    if (user === null && visibility === 'private') {
      setVisibility('public')
    }
  }, [user, visibility])

  // Fetch recent public pastes on mount
  useEffect(() => {
    let active = true
    setLoadingRecent(true)
    api
      .listPastes({ scope: 'public', pageSize: 6 })
      .then((rows) => {
        if (active) setRecent(rows)
      })
      .catch(() => {
        if (active) setRecent([])
      })
      .finally(() => {
        if (active) setLoadingRecent(false)
      })
    return () => {
      active = false
    }
  }, [])

  // --- file handling ---
  function handleFileSelected(f: File | null | undefined) {
    if (!f) {
      setFile(null)
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`File too large (max ${formatBytes(MAX_FILE_BYTES)})`)
      return
    }
    setFile(f)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    handleFileSelected(f)
  }

  function clearFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- submit handlers ---
  async function handleCreateText() {
    if (!textContent.trim()) {
      toast.error('Paste content is empty')
      return
    }
    if (visibility === 'private' && !user) {
      toast.error('Log in to create private pastes')
      return
    }
    setSubmitting(true)
    try {
      const rows = await api.createPaste({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
        language,
        textContent,
        visibility,
        password: passwordEnabled && password ? password : undefined,
        burnAfterRead: burnAfterRead || undefined,
        expiryPreset,
        expiryCustom: expiryPreset === 'custom' ? expiryCustom : undefined,
      })
      toast.success('Paste created')
      const created = rows[0]
      if (created) goView(created.slug)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create paste'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadFile() {
    if (!file) {
      toast.error('Select a file first')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`File too large (max ${formatBytes(MAX_FILE_BYTES)})`)
      return
    }
    if (visibility === 'private' && !user) {
      toast.error('Log in to create private pastes')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (title.trim()) fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      if (tags.trim()) fd.append('tags', tags.trim())
      fd.append('visibility', visibility)
      if (passwordEnabled && password) fd.append('password', password)
      if (burnAfterRead) fd.append('burnAfterRead', 'true')
      fd.append('expiryPreset', expiryPreset)
      if (expiryPreset === 'custom' && expiryCustom) fd.append('expiryCustom', expiryCustom)

      const rows = await api.uploadFile(fd)
      toast.success('File uploaded')
      const created = rows[0]
      if (created) goView(created.slug)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to upload file'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const sidebarProps = {
    user,
    visibility,
    setVisibility,
    passwordEnabled,
    setPasswordEnabled: (v: boolean) => {
      setPasswordEnabled(v)
      if (v) setBurnAfterRead(false)
    },
    password,
    setPassword,
    burnAfterRead,
    setBurnAfterRead: (v: boolean) => {
      setBurnAfterRead(v)
      if (v) setPasswordEnabled(false)
    },
    expiryPreset,
    setExpiryPreset,
    expiryCustom,
    setExpiryCustom,
    submitting,
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <Hero />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'text' | 'file')}>
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="text" className="flex-1 gap-1.5">
            <FileCode className="h-4 w-4" /> Text
          </TabsTrigger>
          <TabsTrigger value="file" className="flex-1 gap-1.5">
            <Upload className="h-4 w-4" /> File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Main / left column */}
            <div className="flex min-h-[60vh] flex-1 flex-col gap-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled paste…"
                className="h-10 text-base"
                aria-label="Paste title"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description…"
                className="min-h-[60px] resize-y text-sm"
                aria-label="Paste description"
              />
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated, tags"
                className="text-sm"
                aria-label="Paste tags"
              />
              <div className="min-h-[400px] flex-1 overflow-hidden rounded-lg border border-border bg-card">
                <CodeEditor
                  value={textContent}
                  onChange={(v) => setTextContent(v ?? '')}
                  language={language}
                  readOnly={false}
                  height="100%"
                  wordWrap
                  showLineNumbers
                />
              </div>
            </div>

            {/* Sidebar */}
            <SidebarCard
              {...sidebarProps}
              language={language}
              setLanguage={setLanguage}
              submitLabel="Create paste"
              onSubmit={handleCreateText}
              submitDisabled={!textContent.trim()}
              submitIcon={<FileCode className="h-4 w-4" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="file" className="mt-4">
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Main / left column */}
            <div className="flex flex-1 flex-col gap-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="File title (optional)…"
                className="h-10 text-base"
                aria-label="File title"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description…"
                className="min-h-[60px] resize-y text-sm"
                aria-label="File description"
              />
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated, tags"
                className="text-sm"
                aria-label="File tags"
              />

              {/* Dropzone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                aria-label="File dropzone — click to browse"
                className={[
                  'flex min-h-[320px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50',
                ].join(' ')}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
                {file ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <FileCode className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="max-w-xs truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} · {file.type || 'unknown type'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearFile()
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Drag &amp; drop a file here</p>
                      <p className="text-xs text-muted-foreground">
                        or{' '}
                        <span className="text-primary underline-offset-2 hover:underline">
                          click to browse
                        </span>{' '}
                        · max {formatBytes(MAX_FILE_BYTES)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <SidebarCard
              {...sidebarProps}
              hideLanguage
              submitLabel="Upload file"
              onSubmit={handleUploadFile}
              submitDisabled={!file}
              submitIcon={<Upload className="h-4 w-4" />}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent public pastes */}
      <RecentPastes pastes={recent} loading={loadingRecent} onBrowse={goBrowse} />
    </div>
  )
}

function Hero() {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/40 py-0">
      <CardContent className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileCode className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Share code &amp; files, instantly.
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              PasteShare is a fast, secure pastebin — syntax highlighting, expiring links,
              password protection, and burn-after-read.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FEATURE_PILLS.map((p) => (
            <Badge key={p.label} variant="secondary" className="gap-1.5 px-3 py-1">
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

type SidebarCardProps = {
  user: SafeUser | null
  language?: string
  setLanguage?: (v: string) => void
  visibility: 'public' | 'unlisted' | 'private'
  setVisibility: (v: 'public' | 'unlisted' | 'private') => void
  passwordEnabled: boolean
  setPasswordEnabled: (v: boolean) => void
  password: string
  setPassword: (v: string) => void
  burnAfterRead: boolean
  setBurnAfterRead: (v: boolean) => void
  expiryPreset: string
  setExpiryPreset: (v: string) => void
  expiryCustom: string
  setExpiryCustom: (v: string) => void
  submitLabel: string
  onSubmit: () => void
  submitting: boolean
  submitDisabled: boolean
  submitIcon: React.ReactNode
  hideLanguage?: boolean
}

function SidebarCard(props: SidebarCardProps) {
  const {
    user,
    language,
    setLanguage,
    visibility,
    setVisibility,
    passwordEnabled,
    setPasswordEnabled,
    password,
    setPassword,
    burnAfterRead,
    setBurnAfterRead,
    expiryPreset,
    setExpiryPreset,
    expiryCustom,
    setExpiryCustom,
    submitLabel,
    onSubmit,
    submitting,
    submitDisabled,
    submitIcon,
    hideLanguage,
  } = props

  return (
    <Card className="h-fit w-full shrink-0 gap-4 md:w-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Options</CardTitle>
        <CardDescription className="text-xs">
          Configure visibility, protection, and expiry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hideLanguage && language !== undefined && setLanguage && (
          <div className="space-y-1.5">
            <Label htmlFor="language-select" className="text-xs">
              Language
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={`${opt.value}-${opt.label}`} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Visibility */}
        <div className="space-y-2">
          <Label className="text-xs">Visibility</Label>
          <RadioGroup
            value={visibility}
            onValueChange={(v) => setVisibility(v as 'public' | 'unlisted' | 'private')}
            className="grid gap-1.5"
          >
            {VISIBILITY_OPTIONS.map((opt) => {
              const disabled = opt.value === 'private' && !user
              const row = (
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value={opt.value}
                    id={`vis-${opt.value}`}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`vis-${opt.value}`}
                    className="flex cursor-pointer items-center gap-1.5 text-xs font-normal"
                  >
                    <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {opt.label}
                  </Label>
                </div>
              )
              if (disabled) {
                return (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <div className="opacity-60">{row}</div>
                    </TooltipTrigger>
                    <TooltipContent>Login required</TooltipContent>
                  </Tooltip>
                )
              }
              return <div key={opt.value}>{row}</div>
            })}
          </RadioGroup>
        </div>

        {/* Password protection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw-switch" className="flex items-center gap-1.5 text-xs">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
            </Label>
            <Switch
              id="pw-switch"
              checked={passwordEnabled}
              onCheckedChange={setPasswordEnabled}
              disabled={burnAfterRead}
            />
          </div>
          {passwordEnabled && (
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="text-sm"
              autoComplete="new-password"
            />
          )}
          {burnAfterRead && (
            <p className="text-[11px] text-muted-foreground">
              Cannot combine with burn-after-read.
            </p>
          )}
        </div>

        {/* Burn after read */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="burn-switch" className="flex items-center gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5 text-muted-foreground" /> Burn after read
            </Label>
            <Switch
              id="burn-switch"
              checked={burnAfterRead}
              onCheckedChange={setBurnAfterRead}
              disabled={passwordEnabled}
            />
          </div>
          {passwordEnabled && (
            <p className="text-[11px] text-muted-foreground">
              Cannot combine with password.
            </p>
          )}
        </div>

        {/* Expiry */}
        <div className="space-y-2">
          <Label htmlFor="expiry-select" className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Expiry
          </Label>
          <Select value={expiryPreset} onValueChange={setExpiryPreset}>
            <SelectTrigger id="expiry-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {expiryPreset === 'custom' && (
            <Input
              type="datetime-local"
              value={expiryCustom}
              onChange={(e) => setExpiryCustom(e.target.value)}
              className="text-sm"
              aria-label="Custom expiry date and time"
            />
          )}
        </div>

        <Button
          onClick={onSubmit}
          disabled={submitDisabled || submitting}
          className="w-full gap-1.5"
          size="lg"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
          {submitLabel}
        </Button>

        {!user && (
          <p className="text-center text-[11px] text-muted-foreground">
            Guest paste — public or unlisted only. Log in for private pastes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RecentPastes({
  pastes,
  loading,
  onBrowse,
}: {
  pastes: SafePaste[]
  loading: boolean
  onBrowse: () => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent public pastes</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onBrowse} className="gap-1.5">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : pastes.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FileCode className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No public pastes yet — be the first!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pastes.map((p) => (
            <PasteCard key={p.id} paste={p} />
          ))}
        </div>
      )}
    </section>
  )
}
