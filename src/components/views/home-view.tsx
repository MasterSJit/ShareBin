'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  FileCode,
  FileText,
  Flame,
  Globe,
  Languages,
  Link as LinkIcon,
  Lock,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { CodeEditor } from '@/components/editor/code-editor'
import { PasteCard } from '@/components/paste-card'
import { Reveal, StaggerGroup, scaleIn } from '@/components/motion-helpers'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { LANGUAGES, EXPIRY_OPTIONS, formatBytes } from '@/lib/ui-utils'
import type { SafePaste, SafeUser } from '@/lib/types'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB cap (mirrors server enforcement)

const FEATURE_PILLS = ['45+ languages', 'Burn after read', 'Password-protected']

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

const TAB_TRIGGER_ACTIVE =
  'data-[state=active]:border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand data-[state=active]:to-brand-2 data-[state=active]:text-brand-foreground data-[state=active]:shadow-md data-[state=active]:shadow-brand/30'

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
      toast.success('Paste created ✨')
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
      toast.success('File uploaded ✨')
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Hero />

      {/* Create card */}
      <Reveal delay={0.1} className="mt-8">
        <div className="glass-strong gradient-border glow-brand relative rounded-2xl p-4 sm:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'text' | 'file')}>
            <TabsList className="mb-6 grid w-full max-w-xs grid-cols-2">
              <TabsTrigger
                value="text"
                className={`flex items-center gap-1.5 ${TAB_TRIGGER_ACTIVE}`}
              >
                <FileCode className="h-4 w-4" /> Text
              </TabsTrigger>
              <TabsTrigger
                value="file"
                className={`flex items-center gap-1.5 ${TAB_TRIGGER_ACTIVE}`}
              >
                <Upload className="h-4 w-4" /> File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main / left column */}
                <div className="space-y-4 lg:col-span-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled paste…"
                    className="h-12 border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                    aria-label="Paste title"
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description…"
                    className="min-h-[60px] resize-y border-0 bg-muted/30 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-brand"
                    aria-label="Paste description"
                  />
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="comma, separated, tags"
                    className="border-0 bg-muted/30 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-brand"
                    aria-label="Paste tags"
                  />

                  {/* Editor with traffic-light top bar */}
                  <div className="overflow-hidden rounded-xl border border-border/50">
                    <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <div className="h-2.5 w-2.5 rounded-full bg-brand" />
                      </div>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {language}
                      </span>
                    </div>
                    <div className="min-h-[420px]">
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
                    submitIcon={<Sparkles className="h-4 w-4" />}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="file" className="outline-none">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main / left column */}
                <div className="space-y-4 lg:col-span-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="File title (optional)…"
                    className="h-12 border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                    aria-label="File title"
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description…"
                    className="min-h-[60px] resize-y border-0 bg-muted/30 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-brand"
                    aria-label="File description"
                  />
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="comma, separated, tags"
                    className="border-0 bg-muted/30 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-brand"
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
                      'relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      dragOver
                        ? 'border-brand bg-brand/5 glow-brand'
                        : 'border-border/60 bg-muted/20 backdrop-blur-md hover:border-brand/50 hover:bg-muted/30',
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
                        className="flex w-full max-w-md items-center gap-4 rounded-xl glass p-4"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-brand-foreground shadow-md shadow-brand/30">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(file.size)} · {file.type || 'unknown'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearFile()
                          }}
                          aria-label="Remove file"
                          className="h-8 w-8 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ) : (
                      <>
                        <motion.div
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30"
                        >
                          <Upload className="h-7 w-7" />
                        </motion.div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Drop a file here or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Max {formatBytes(MAX_FILE_BYTES)}
                          </p>
                        </div>
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
      </Reveal>

      {/* Recent public pastes */}
      <RecentPastes pastes={recent} loading={loadingRecent} onBrowse={goBrowse} />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center gap-6 py-10 text-center sm:py-16">
      {/* Floating feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FEATURE_PILLS.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.5,
              }}
              className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand to-brand-2" />
              {label}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
      >
        Share code &amp; files,
        <br />
        <span className="text-gradient-animated">beautifully.</span>
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="max-w-2xl text-sm text-muted-foreground sm:text-base"
      >
        Pastebin reimagined — Monaco syntax highlighting, burn-after-read, password protection, and more.
      </motion.p>

      {/* Scroll chevron */}
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-2 text-muted-foreground/60"
        aria-hidden
      >
        <ChevronDown className="h-5 w-5" />
      </motion.div>
    </section>
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
    <div className="glass space-y-4 rounded-xl p-4">
      {/* Language */}
      {!hideLanguage && language !== undefined && setLanguage && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" /> Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full bg-muted/30">
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
        <Label className="text-xs font-medium">Visibility</Label>
        <RadioGroup
          value={visibility}
          onValueChange={(v) => setVisibility(v as 'public' | 'unlisted' | 'private')}
          className="grid gap-1.5"
        >
          {VISIBILITY_OPTIONS.map((opt) => {
            const disabled = opt.value === 'private' && !user
            const selected = visibility === opt.value
            const card = (
              <Label
                htmlFor={`vis-${opt.value}`}
                className={[
                  'glass flex items-center gap-2 rounded-lg px-3 py-2 transition-all',
                  selected ? 'ring-2 ring-brand bg-brand/5' : '',
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                ].join(' ')}
              >
                <RadioGroupItem
                  id={`vis-${opt.value}`}
                  value={opt.value}
                  disabled={disabled}
                  className="h-3.5 w-3.5 border-brand text-brand"
                />
                <opt.icon
                  className={[
                    'h-3.5 w-3.5',
                    selected ? 'text-brand' : 'text-muted-foreground',
                  ].join(' ')}
                />
                <span className="text-xs font-medium">{opt.label}</span>
                {disabled && (
                  <Lock className="ml-auto h-3 w-3 text-muted-foreground" />
                )}
              </Label>
            )
            if (disabled) {
              return (
                <Tooltip key={opt.value}>
                  <TooltipTrigger asChild>
                    <div>{card}</div>
                  </TooltipTrigger>
                  <TooltipContent>Login required</TooltipContent>
                </Tooltip>
              )
            }
            return <div key={opt.value}>{card}</div>
          })}
        </RadioGroup>
      </div>

      {/* Password protection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="pw-switch"
            className="flex items-center gap-1.5 text-xs font-medium"
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
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-8 text-sm"
              autoComplete="new-password"
            />
          </div>
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
          <Label
            htmlFor="burn-switch"
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <Flame className="h-3.5 w-3.5 text-muted-foreground" /> Burn after read
          </Label>
          <Switch
            id="burn-switch"
            checked={burnAfterRead}
            onCheckedChange={setBurnAfterRead}
            disabled={passwordEnabled}
            className="data-[state=checked]:bg-brand-2"
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
        <Label
          htmlFor="expiry-select"
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Expiry
        </Label>
        <Select value={expiryPreset} onValueChange={setExpiryPreset}>
          <SelectTrigger id="expiry-select" className="w-full bg-muted/30">
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

      {/* Submit */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled || submitting}
        className="btn-shine relative w-full gap-1.5 overflow-hidden bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 hover:shadow-brand/50"
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
    <section className="mt-12 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-semibold tracking-tight">
            Recent public pastes
          </h2>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="shimmer h-48 rounded-xl bg-muted/40"
              aria-hidden
            />
          ))}
        </div>
      ) : pastes.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl py-12 text-center">
          <FileCode className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No public pastes yet — be the first!
          </p>
        </div>
      ) : (
        <StaggerGroup
          stagger={0.1}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pastes.map((p) => (
            <Reveal key={p.id} variant={scaleIn}>
              <PasteCard paste={p} />
            </Reveal>
          ))}
        </StaggerGroup>
      )}
    </section>
  )
}
