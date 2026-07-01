'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowRight,
  FileCode,
  FileText,
  Flame,
  Globe,
  Link as Link2,
  Lock,
  Loader2,
  Plus,
  Tag,
  Upload,
  X,
} from 'lucide-react'

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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CodeEditor } from '@/components/editor/code-editor'
import { PasteCard } from '@/components/paste-card'
import {
  Reveal,
  StaggerGroup,
  fadeUp,
} from '@/components/motion-helpers'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { LANGUAGES, EXPIRY_OPTIONS, formatBytes } from '@/lib/ui-utils'
import type { SafePaste, SafeUser } from '@/lib/types'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB cap (mirrors server enforcement)

const VISIBILITY_OPTIONS: {
  value: 'public' | 'unlisted' | 'private'
  label: string
  icon: typeof Globe
}[] = [
  { value: 'public', label: 'Public', icon: Globe },
  { value: 'unlisted', label: 'Unlisted', icon: Link2 },
  { value: 'private', label: 'Private', icon: Lock },
]

// Deduped language list — "Auto-detect" (plaintext) first.
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

const FEATURE_CHIPS = ['45+ languages', 'burn-after-read', 'password-protected']

const SECTION_LABEL_CLS =
  'font-mono text-[11px] uppercase tracking-wider text-muted-foreground'

const BORDERLESS_INPUT_CLS =
  'border-0 border-b border-border rounded-none px-0 text-sm focus-visible:border-brand focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 h-auto py-2 shadow-none'

const TAB_TRIGGER_CLS =
  'rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 pt-1 text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'

export function HomeView() {
  const user = useAppStore((s) => s.user)
  const goView = useAppStore((s) => s.goView)
  const goBrowse = useAppStore((s) => s.goBrowse)
  const goLogin = useAppStore((s) => s.goLogin)

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

  // recent public pastes
  const [recent, setRecent] = useState<SafePaste[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  // Demote private → public if the user logs out while private is selected.
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
    handleFileSelected(e.dataTransfer.files?.[0])
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
    onLogin: goLogin,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      {/* ----------------------------------------------------------- */}
      {/* Hero — editorial, left-aligned                              */}
      {/* ----------------------------------------------------------- */}
      <Reveal>
        <section className="space-y-4">
          <span className="font-mono text-xs text-brand">
            {'>'} new_paste.sh
          </span>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Share code, <span className="text-gradient">beautifully.</span>
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Monaco-grade syntax highlighting. Burn-after-read. Password
            protection. Zero friction.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {FEATURE_CHIPS.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className="brand-dot" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ----------------------------------------------------------- */}
      {/* Create panel — surface card w/ terminal-strip window chrome  */}
      {/* ----------------------------------------------------------- */}
      <Reveal delay={0.1} className="mt-8">
        <div className="surface overflow-hidden rounded-2xl">
          {/* Window chrome */}
          <div className="terminal-strip flex h-10 items-center gap-2 px-4">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-500" aria-hidden />
              <div className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
              <div className="h-3 w-3 rounded-full bg-brand" aria-hidden />
            </div>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              pasteshare — new
            </span>
          </div>

          {/* Body */}
          <div className="p-5 md:p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'text' | 'file')}>
              <TabsList className="h-auto gap-5 bg-transparent p-0">
                <TabsTrigger value="text" className={TAB_TRIGGER_CLS}>
                  <FileCode className="h-3.5 w-3.5" /> Text
                </TabsTrigger>
                <TabsTrigger value="file" className={TAB_TRIGGER_CLS}>
                  <Upload className="h-3.5 w-3.5" /> File
                </TabsTrigger>
              </TabsList>

              {/* ----------------------- TEXT TAB ----------------------- */}
              <TabsContent value="text" className="mt-5 outline-none">
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* Main / left column */}
                  <div className="space-y-3 lg:col-span-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Untitled paste…"
                      className={`${BORDERLESS_INPUT_CLS} text-xl font-medium`}
                      aria-label="Paste title"
                    />
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short description…"
                      className={BORDERLESS_INPUT_CLS}
                      aria-label="Paste description"
                    />
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="comma, separated, tags"
                        className={`${BORDERLESS_INPUT_CLS} pl-5`}
                        aria-label="Paste tags"
                      />
                    </div>

                    {/* Monaco editor container */}
                    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-2">
                      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {language}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                          read-write
                        </span>
                      </div>
                      <div className="min-h-[420px]">
                        <CodeEditor
                          value={textContent}
                          onChange={(v) => setTextContent(v ?? '')}
                          language={language}
                          height="100%"
                          wordWrap
                          showLineNumbers
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:col-span-1">
                    <SidebarCard
                      {...sidebarProps}
                      language={language}
                      setLanguage={setLanguage}
                      submitLabel="Create paste"
                      onSubmit={handleCreateText}
                      submitDisabled={!textContent.trim()}
                      submitIcon={<Plus className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ----------------------- FILE TAB ----------------------- */}
              <TabsContent value="file" className="mt-5 outline-none">
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* Main / left column */}
                  <div className="space-y-3 lg:col-span-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="File title (optional)…"
                      className={`${BORDERLESS_INPUT_CLS} text-xl font-medium`}
                      aria-label="File title"
                    />
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short description…"
                      className={BORDERLESS_INPUT_CLS}
                      aria-label="File description"
                    />
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="comma, separated, tags"
                        className={`${BORDERLESS_INPUT_CLS} pl-5`}
                        aria-label="File tags"
                      />
                    </div>

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
                        'mt-4 flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        dragOver
                          ? 'border-brand bg-brand/5'
                          : 'border-border bg-surface-2/50 hover:border-brand hover:bg-brand/5',
                      ].join(' ')}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileSelected(e.target.files?.[0])}
                      />
                      {file ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex w-full max-w-md items-center gap-4 rounded-lg border border-border bg-surface p-4"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-medium">
                              {file.name}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {formatBytes(file.size)} · {file.type || 'unknown'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              clearFile()
                            }}
                            aria-label="Remove file"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ) : (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-muted-foreground">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Drop a file here</p>
                            <p className="text-xs text-muted-foreground">
                              or click to browse
                            </p>
                          </div>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            Max {formatBytes(MAX_FILE_BYTES)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:col-span-1">
                    <SidebarCard
                      {...sidebarProps}
                      hideLanguage
                      submitLabel="Upload file"
                      onSubmit={handleUploadFile}
                      submitDisabled={!file}
                      submitIcon={<Upload className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Reveal>

      {/* ----------------------------------------------------------- */}
      {/* Recent public pastes                                        */}
      {/* ----------------------------------------------------------- */}
      <RecentPastes
        pastes={recent}
        loading={loadingRecent}
        onBrowse={goBrowse}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar — language / visibility / password / burn / expiry + CTA   */
/* ------------------------------------------------------------------ */

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
  onLogin: () => void
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
    onLogin,
  } = props

  return (
    <div className="surface-2 space-y-4 rounded-xl p-4">
      {/* Language */}
      {!hideLanguage && language !== undefined && setLanguage && (
        <div className="space-y-1.5">
          <Label className={SECTION_LABEL_CLS}>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full border-border bg-surface-3">
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

      {/* Visibility — 3 stacked radio cards */}
      <div className="space-y-1.5">
        <Label className={SECTION_LABEL_CLS}>Visibility</Label>
        <div className="space-y-1.5">
          {VISIBILITY_OPTIONS.map((opt) => {
            const disabled = opt.value === 'private' && !user
            const selected = visibility === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setVisibility(opt.value)}
                aria-pressed={selected}
                className={[
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  selected
                    ? 'border-brand bg-brand/5 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ].join(' ')}
              >
                <opt.icon
                  className={[
                    'h-3.5 w-3.5',
                    selected ? 'text-brand' : 'text-muted-foreground',
                  ].join(' ')}
                />
                <span className="flex-1 text-left">{opt.label}</span>
                {disabled && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    login required
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="pw-switch"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
          </Label>
          <Switch
            id="pw-switch"
            checked={passwordEnabled}
            onCheckedChange={setPasswordEnabled}
            disabled={burnAfterRead}
            className="data-[state=checked]:bg-brand"
          />
        </div>
        {passwordEnabled && (
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="bg-surface-3"
            autoComplete="new-password"
          />
        )}
      </div>

      {/* Burn after read */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="burn-switch"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <Flame className="h-3.5 w-3.5 text-muted-foreground" /> Burn after
            read
          </Label>
          <Switch
            id="burn-switch"
            checked={burnAfterRead}
            onCheckedChange={setBurnAfterRead}
            disabled={passwordEnabled}
            className="data-[state=checked]:bg-brand-2"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Deleted after first view
        </p>
      </div>

      {/* Expiry */}
      <div className="space-y-1.5">
        <Label htmlFor="expiry-select" className={SECTION_LABEL_CLS}>
          Expires
        </Label>
        <Select value={expiryPreset} onValueChange={setExpiryPreset}>
          <SelectTrigger
            id="expiry-select"
            className="w-full border-border bg-surface-3"
          >
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
            className="bg-surface-3"
            aria-label="Custom expiry date and time"
          />
        )}
      </div>

      {/* Submit */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled || submitting}
        className="btn-shine relative w-full gap-1.5 overflow-hidden rounded-md bg-brand text-brand-foreground font-medium hover:bg-brand/90"
        size="lg"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          submitIcon
        )}
        {submitLabel}
      </Button>

      {!user && (
        <p className="text-center text-[11px] text-muted-foreground">
          Guest paste —{' '}
          <button
            type="button"
            onClick={onLogin}
            className="font-medium text-brand hover:underline"
          >
            log in
          </button>{' '}
          for private pastes
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Recent public pastes                                               */
/* ------------------------------------------------------------------ */

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
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Recent</h2>
          <span className="font-mono text-xs text-muted-foreground">/public</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBrowse}
          className="group gap-1.5 text-muted-foreground hover:text-foreground"
        >
          Browse all
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="shimmer h-40 rounded-xl bg-surface"
              aria-hidden
            />
          ))}
        </div>
      ) : pastes.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No public pastes yet. Be the first.
          </p>
        </div>
      ) : (
        <StaggerGroup
          stagger={0.07}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {pastes.map((p) => (
            <Reveal key={p.id} variant={fadeUp}>
              <PasteCard paste={p} />
            </Reveal>
          ))}
        </StaggerGroup>
      )}
    </section>
  )
}
