'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  LogIn,
  Plus,
  Sparkles,
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
import { AdSlot } from '@/components/ad-slot'
import { PasteCard } from '@/components/paste-card'
import { Reveal, StaggerGroup, fadeUp } from '@/components/motion-helpers'
import {
  useGsapHeroEntrance,
  useGsapMagnetic,
  SplitText,
} from '@/components/gsap-helpers'
import { ShareDialog, type CreatedPaste } from '@/components/share-dialog'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { usePublicSettings } from '@/hooks/use-public-settings'
import { LANGUAGES, EXPIRY_OPTIONS, formatBytes, detectLanguage, languageLabel } from '@/lib/ui-utils'
import type { SafePaste, SafeUser } from '@/lib/types'

const MAX_FILES_PER_BATCH = 10

/** Guest limits — mirrors FREE_LIMITS in src/lib/rbac.ts. */
const GUEST_LIMITS: PlanLimits = {
  name: 'Guest',
  allowedExpiryPresets: ['never', '10m', '1h', '1d'],
  allowCustomExpiry: false,
  allowBurnAfterRead: true,
  allowPassword: false,
  allowPrivate: false,
  allowFileUpload: false,
  maxPasteSize: 1024 * 1024,
  maxPastesPerMonth: 10,
}

type PlanLimits = {
  name: string
  allowedExpiryPresets: string[]
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
  maxPasteSize: number
  maxPastesPerMonth: number
}

const VISIBILITY_OPTIONS: {
  value: 'public' | 'unlisted' | 'private'
  label: string
  icon: typeof Globe
  hint: string
}[] = [
  { value: 'public', label: 'Public', icon: Globe, hint: 'Listed in Browse' },
  { value: 'unlisted', label: 'Unlisted', icon: Link2, hint: 'Only people with the link' },
  { value: 'private', label: 'Private', icon: Lock, hint: 'Only you' },
]

const LANGUAGE_OPTIONS = LANGUAGES

const FEATURE_CHIPS = ['45+ languages', 'burn-after-read', 'password-protected', 'file sharing']

const SECTION_LABEL_CLS =
  'font-mono text-[11px] uppercase tracking-wider text-muted-foreground'

// Underline tabs. The shadcn trigger draws a bordered "pill" when active in
// dark mode; cancel every side except the bottom so only the underline shows.
const TAB_TRIGGER_CLS =
  'flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 pt-1 text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:border-b-brand dark:data-[state=active]:bg-transparent'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const SUBMIT_HINT = isMac ? '⌘ Enter' : 'Ctrl Enter'

export function HomeView() {
  const user = useAppStore((s) => s.user)
  const goView = useAppStore((s) => s.goView)
  const goBrowse = useAppStore((s) => s.goBrowse)
  const goLogin = useAppStore((s) => s.goLogin)
  const takeDraft = useAppStore((s) => s.takeDraft)
  const { settings, loading: settingsLoading } = usePublicSettings()

  // GSAP hero entrance
  const heroRef = useGsapHeroEntrance<HTMLDivElement>()

  // --- shared form state ---
  const [tab, setTab] = useState<'text' | 'file'>('text')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  // text-only
  const [textContent, setTextContent] = useState('')
  const [language, setLanguageState] = useState('plaintext')
  // Once the user picks a language we stop auto-detecting.
  const [languageTouched, setLanguageTouched] = useState(false)
  const [autoDetected, setAutoDetected] = useState(false)

  // file-only
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<{ index: number; total: number; fraction: number } | null>(null)

  // shared options
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public')
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [burnAfterRead, setBurnAfterRead] = useState(false)
  const [expiryPreset, setExpiryPresetState] = useState('never')
  const [expiryTouched, setExpiryTouched] = useState(false)
  const [expiryCustom, setExpiryCustom] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreatedPaste[]>([])
  const [shareOpen, setShareOpen] = useState(false)

  // recent public pastes
  const [recent, setRecent] = useState<SafePaste[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [recentNonce, setRecentNonce] = useState(0)

  // plan limits (for gating expiry/feature options)
  const [limits, setLimits] = useState<PlanLimits | null>(null)

  function setLanguage(v: string) {
    setLanguageState(v)
    setLanguageTouched(true)
    setAutoDetected(false)
  }
  function setExpiryPreset(v: string) {
    setExpiryPresetState(v)
    setExpiryTouched(true)
  }

  useEffect(() => {
    if (!user) {
      setLimits(GUEST_LIMITS)
      return
    }
    let active = true
    api.myLimits().then((rows) => {
      if (!active || !rows[0]) return
      const p = rows[0].plan
      setLimits({
        name: p.name,
        allowedExpiryPresets: p.allowedExpiryPresets,
        allowCustomExpiry: p.allowCustomExpiry,
        allowBurnAfterRead: p.allowBurnAfterRead,
        allowPassword: p.allowPassword,
        allowPrivate: p.allowPrivate,
        allowFileUpload: p.allowFileUpload,
        maxPasteSize: p.maxPasteSize,
        maxPastesPerMonth: p.maxPastesPerMonth,
      })
    }).catch(() => {
      if (active) setLimits(null)
    })
    return () => { active = false }
  }, [user])

  // Pre-fill from "Clone" (paste view → New paste with this content).
  useEffect(() => {
    const d = takeDraft()
    if (!d) return
    setTab('text')
    setTitle(d.title)
    setDescription(d.description)
    setTags(d.tags)
    setTextContent(d.textContent)
    setLanguageState(d.language || 'plaintext')
    setLanguageTouched(true)
    toast.message('Cloned into a new paste — edit and create when ready')
  }, [takeDraft])

  // Apply the site's default expiry once settings arrive (unless the user chose one).
  useEffect(() => {
    if (settingsLoading || expiryTouched) return
    setExpiryPresetState(settings.defaultExpiry || 'never')
  }, [settingsLoading, settings.defaultExpiry, expiryTouched])

  useEffect(() => {
    if (user === null && visibility === 'private') {
      setVisibility('public')
    }
  }, [user, visibility])

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
  }, [recentNonce])

  // Auto-detect the language from the content until the user picks one.
  useEffect(() => {
    if (languageTouched) return
    if (textContent.trim().length < 16) {
      if (autoDetected) {
        setLanguageState('plaintext')
        setAutoDetected(false)
      }
      return
    }
    const t = setTimeout(() => {
      const detected = detectLanguage(textContent)
      setLanguageState(detected)
      setAutoDetected(detected !== 'plaintext')
    }, 350)
    return () => clearTimeout(t)
  }, [textContent, languageTouched, autoDetected])

  const effectiveLimits = limits ?? GUEST_LIMITS
  const canUpload = !!user && effectiveLimits.allowFileUpload
  const canPost = !!user || settings.guestPostingEnabled
  const maxFileBytes = Math.min(effectiveLimits.maxPasteSize, settings.maxFileSizeBytes)

  const textBytes = useMemo(() => new TextEncoder().encode(textContent).length, [textContent])
  const lineCount = textContent ? textContent.split('\n').length : 0
  const tooLarge = textBytes > effectiveLimits.maxPasteSize

  // --- file handling ---
  const addFiles = useCallback(
    (list: FileList | File[] | null | undefined) => {
      const incoming = Array.from(list ?? [])
      if (!incoming.length) return
      const accepted: File[] = []
      for (const f of incoming) {
        if (f.size === 0) {
          toast.error(`${f.name || 'File'} is empty`)
        } else if (f.size > maxFileBytes) {
          toast.error(`${f.name} is too large (max ${formatBytes(maxFileBytes)})`)
        } else {
          accepted.push(f)
        }
      }
      setFiles((cur) => {
        const merged = [...cur, ...accepted].slice(0, MAX_FILES_PER_BATCH)
        if (cur.length + accepted.length > MAX_FILES_PER_BATCH) {
          toast.error(`Up to ${MAX_FILES_PER_BATCH} files at a time`)
        }
        return merged
      })
    },
    [maxFileBytes],
  )

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  function removeFile(index: number) {
    setFiles((cur) => cur.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Paste an image/file from the clipboard anywhere on the page → File tab.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const pasted = e.clipboardData?.files
      if (!pasted || pasted.length === 0) return
      e.preventDefault()
      if (!canUpload) {
        toast.error(user ? 'File uploads are not included in your plan' : 'Log in to upload files')
        return
      }
      setTab('file')
      // Clipboard images have generic names; give them a timestamped one.
      const named = Array.from(pasted).map((f) =>
        f.name && f.name !== 'image.png'
          ? f
          : new File([f], `pasted-${new Date().toISOString().replace(/[:.]/g, '-')}.${(f.type.split('/')[1] || 'bin').replace('jpeg', 'jpg')}`, { type: f.type }),
      )
      addFiles(named)
      toast.success('File pasted from clipboard')
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles, canUpload, user])

  function resetContent() {
    setTitle('')
    setDescription('')
    setTags('')
    setTextContent('')
    setLanguageState('plaintext')
    setLanguageTouched(false)
    setAutoDetected(false)
    setFiles([])
    setPassword('')
    setPasswordEnabled(false)
    setBurnAfterRead(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onCreated(rows: CreatedPaste[]) {
    setCreated(rows)
    setShareOpen(true)
    resetContent()
    setRecentNonce((n) => n + 1)
  }

  // --- submit handlers ---
  async function handleCreateText() {
    if (submitting) return
    if (!textContent.trim()) {
      toast.error('Paste content is empty')
      return
    }
    if (!canPost) {
      toast.error('Guest posting is disabled — log in to create pastes')
      return
    }
    if (tooLarge) {
      toast.error(`Paste is too large for the ${effectiveLimits.name} plan (max ${formatBytes(effectiveLimits.maxPasteSize)})`)
      return
    }
    if (passwordEnabled && !password) {
      toast.error('Enter a password or turn password protection off')
      return
    }
    if (expiryPreset === 'custom' && !expiryCustom) {
      toast.error('Pick a custom expiry date')
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
        expiryCustom: expiryPreset === 'custom' && expiryCustom ? new Date(expiryCustom).toISOString() : undefined,
      })
      if (rows[0]) onCreated(rows)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create paste'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadFiles() {
    if (submitting) return
    if (files.length === 0) {
      toast.error('Select a file first')
      return
    }
    if (passwordEnabled && !password) {
      toast.error('Enter a password or turn password protection off')
      return
    }
    if (expiryPreset === 'custom' && !expiryCustom) {
      toast.error('Pick a custom expiry date')
      return
    }
    setSubmitting(true)
    const done: CreatedPaste[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fd = new FormData()
        fd.append('file', file)
        // Title applies to a single upload; batches use each file's name.
        if (title.trim() && files.length === 1) fd.append('title', title.trim())
        if (description.trim()) fd.append('description', description.trim())
        if (tags.trim()) fd.append('tags', tags.trim())
        fd.append('visibility', visibility)
        if (passwordEnabled && password) fd.append('password', password)
        if (burnAfterRead) fd.append('burnAfterRead', 'true')
        fd.append('expiryPreset', expiryPreset)
        if (expiryPreset === 'custom' && expiryCustom) fd.append('expiryCustom', new Date(expiryCustom).toISOString())

        setUploadProgress({ index: i, total: files.length, fraction: 0 })
        const rows = await api.uploadFileWithProgress(fd, (fraction) =>
          setUploadProgress({ index: i, total: files.length, fraction }),
        )
        if (rows[0]) done.push(rows[0])
      }
      onCreated(done)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to upload file'
      toast.error(done.length ? `${msg} (${done.length} of ${files.length} uploaded)` : msg)
      if (done.length) {
        setCreated(done)
        setShareOpen(true)
      }
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  // Ctrl/Cmd+Enter submits from anywhere on the page (Monaco handles its own).
  const submitRef = useRef<() => void>(() => {})
  submitRef.current = tab === 'text' ? handleCreateText : handleUploadFiles
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sidebarProps: SidebarBaseProps = {
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
    limits,
    canPost,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      {/* ----------------------------------------------------------- */}
      {/* Hero — GSAP char-split entrance                              */}
      {/* ----------------------------------------------------------- */}
      <div ref={heroRef}>
        <section className="space-y-4">
          <span
            data-hero="eyebrow"
            className="inline-block font-mono text-xs text-brand"
          >
            {'>'} new_paste.sh
          </span>
          <h1
            data-hero="title"
            className="text-4xl font-semibold tracking-tight md:text-5xl"
          >
            <SplitText text="Share code, " />
            <span data-hero="gradient" className="text-gradient">
              beautifully.
            </span>
          </h1>
          <p
            data-hero="subtitle"
            className="max-w-2xl text-base text-muted-foreground"
          >
            Monaco-grade syntax highlighting. Burn-after-read. Password
            protection. File sharing. Zero friction.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {FEATURE_CHIPS.map((label) => (
              <span
                key={label}
                data-hero="chip"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className="brand-dot" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </section>
      </div>

      {!canPost && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm">
          <LogIn className="h-4 w-4 shrink-0 text-brand" />
          <p className="flex-1 text-muted-foreground">Guest posting is disabled on this site. Log in or create an account to share.</p>
          <Button size="sm" onClick={goLogin} className="bg-brand text-brand-foreground hover:bg-brand/90">Log in</Button>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* Create panel — NOT wrapped in Reveal (Monaco needs clean    */}
      {/* stacking context). Use a simple fade-in via GSAP instead.    */}
      {/* ----------------------------------------------------------- */}
      <CreatePanel
        tab={tab}
        setTab={setTab}
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        tags={tags}
        setTags={setTags}
        textContent={textContent}
        setTextContent={setTextContent}
        language={language}
        setLanguage={setLanguage}
        autoDetected={autoDetected}
        textBytes={textBytes}
        lineCount={lineCount}
        maxTextBytes={effectiveLimits.maxPasteSize}
        files={files}
        dragOver={dragOver}
        setDragOver={setDragOver}
        fileInputRef={fileInputRef}
        addFiles={addFiles}
        onDrop={onDrop}
        removeFile={removeFile}
        clearFiles={() => {
          setFiles([])
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
        canUpload={canUpload}
        maxFileBytes={maxFileBytes}
        uploadProgress={uploadProgress}
        user={user}
        onLogin={goLogin}
        sidebarProps={sidebarProps}
        handleCreateText={handleCreateText}
        handleUploadFiles={handleUploadFiles}
        tooLarge={tooLarge}
      />

      {/* ----------------------------------------------------------- */}
      {/* Between-cards sponsored slot                                */}
      {/* ----------------------------------------------------------- */}
      <AdSlot slot="between-cards" className="mt-6" />

      {/* ----------------------------------------------------------- */}
      {/* Recent public pastes                                        */}
      {/* ----------------------------------------------------------- */}
      <RecentPastes
        pastes={recent}
        loading={loadingRecent}
        onBrowse={goBrowse}
      />

      <ShareDialog
        pastes={created}
        open={shareOpen}
        onOpenChange={setShareOpen}
        isLoggedIn={!!user}
        onView={(slug) => {
          setShareOpen(false)
          goView(slug)
        }}
        onNew={() => setShareOpen(false)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Create panel — isolated so Monaco has a clean stacking context     */
/* ------------------------------------------------------------------ */

function CreatePanel(props: {
  tab: 'text' | 'file'
  setTab: (v: 'text' | 'file') => void
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  tags: string
  setTags: (v: string) => void
  textContent: string
  setTextContent: (v: string) => void
  language: string
  setLanguage: (v: string) => void
  autoDetected: boolean
  textBytes: number
  lineCount: number
  maxTextBytes: number
  tooLarge: boolean
  files: File[]
  dragOver: boolean
  setDragOver: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  addFiles: (f: FileList | File[] | null | undefined) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  removeFile: (index: number) => void
  clearFiles: () => void
  canUpload: boolean
  maxFileBytes: number
  uploadProgress: { index: number; total: number; fraction: number } | null
  user: SafeUser | null
  onLogin: () => void
  sidebarProps: SidebarBaseProps
  handleCreateText: () => void
  handleUploadFiles: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // GSAP entrance for the panel (no filter/transform persisted)
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ctx = (async () => {
      const { gsap } = await import('gsap')
      gsap.fromTo(
        el,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.3 },
      )
    })()
    return () => {
      ctx.catch(() => {})
    }
  }, [])

  const {
    tab,
    setTab,
    title,
    setTitle,
    description,
    setDescription,
    tags,
    setTags,
    textContent,
    setTextContent,
    language,
    setLanguage,
    autoDetected,
    textBytes,
    lineCount,
    maxTextBytes,
    tooLarge,
    files,
    dragOver,
    setDragOver,
    fileInputRef,
    addFiles,
    onDrop,
    removeFile,
    clearFiles,
    canUpload,
    maxFileBytes,
    uploadProgress,
    user,
    onLogin,
    sidebarProps,
    handleCreateText,
    handleUploadFiles,
  } = props

  const totalFileBytes = files.reduce((s, f) => s + f.size, 0)
  const { settings } = usePublicSettings()
  const siteSlug = settings.siteName.toLowerCase().replace(/\s+/g, '-')

  return (
    <div ref={panelRef} className="mt-8">
      <div className="surface overflow-hidden rounded-2xl">
        {/* Window chrome */}
        <div className="terminal-strip flex h-10 items-center gap-2 px-4">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500" aria-hidden />
            <div className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
            <div className="h-3 w-3 rounded-full bg-brand" aria-hidden />
          </div>
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {siteSlug} — new
          </span>
          <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:inline">
            {SUBMIT_HINT} to {tab === 'text' ? 'create' : 'upload'}
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
                  <MetaFields
                    idPrefix="paste"
                    titleLabel="Title"
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    tags={tags}
                    setTags={setTags}
                  />

                  {/* Monaco editor container — NO animation wrapper */}
                  <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        {languageLabel(language)}
                        {autoDetected && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-brand/10 px-1 text-[9px] uppercase tracking-wider text-brand" title="Detected from the content — pick a language to override">
                            <Sparkles className="h-2.5 w-2.5" /> auto
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                        read-write
                      </span>
                    </div>
                    <CodeEditor
                      value={textContent}
                      onChange={(v) => setTextContent(v ?? '')}
                      language={language}
                      height={420}
                      wordWrap
                      showLineNumbers
                      onSubmitShortcut={handleCreateText}
                    />
                    <div className="flex items-center justify-between border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                      <span>
                        {lineCount} line{lineCount === 1 ? '' : 's'} · {textContent.length.toLocaleString()} chars
                      </span>
                      <span className={tooLarge ? 'text-destructive' : ''}>
                        {formatBytes(textBytes)} / {formatBytes(maxTextBytes)}
                      </span>
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
                    submitDisabled={!textContent.trim() || tooLarge || !sidebarProps.canPost}
                    submitIcon={<Plus className="h-4 w-4" />}
                  />
                  <AdSlot slot="sidebar" className="mt-4" />
                </div>
              </div>
            </TabsContent>

            {/* ----------------------- FILE TAB ----------------------- */}
            <TabsContent value="file" className="mt-5 outline-none">
              <div className="grid gap-5 lg:grid-cols-3">
                {/* Main / left column */}
                <div className="space-y-3 lg:col-span-2">
                  <MetaFields
                    idPrefix="file"
                    titleLabel={files.length > 1 ? 'Title (single file only)' : 'File title'}
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    tags={tags}
                    setTags={setTags}
                  />

                  {!canUpload ? (
                    <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-2/50 p-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-muted-foreground">
                        <Lock className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium">
                        {user ? 'File uploads are not included in your plan' : 'File uploads need an account'}
                      </p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {user
                          ? 'Ask an administrator to upgrade your plan to share files.'
                          : 'Create a free account to upload images, archives, PDFs and more.'}
                      </p>
                      {!user && (
                        <Button size="sm" onClick={onLogin} className="mt-1 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90">
                          <LogIn className="h-4 w-4" /> Log in / sign up
                        </Button>
                      )}
                    </div>
                  ) : (
                    /* Dropzone */
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
                        multiple
                        className="hidden"
                        onChange={(e) => addFiles(e.target.files)}
                      />
                      {files.length > 0 ? (
                        <div className="flex w-full max-w-md flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                          {files.map((file, i) => {
                            const active = uploadProgress?.index === i
                            const doneUpload = uploadProgress ? i < uploadProgress.index : false
                            return (
                              <motion.div
                                key={`${file.name}-${i}`}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.25 }}
                                className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface p-3"
                              >
                                {active && (
                                  <div
                                    className="absolute inset-y-0 left-0 bg-brand/10 transition-[width]"
                                    style={{ width: `${Math.round((uploadProgress?.fraction ?? 0) * 100)}%` }}
                                    aria-hidden
                                  />
                                )}
                                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                                  {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                </div>
                                <div className="relative min-w-0 flex-1 text-left">
                                  <p className="truncate text-sm font-medium">{file.name}</p>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    {formatBytes(file.size)} · {file.type || 'unknown'}
                                    {active && ` · ${Math.round((uploadProgress?.fraction ?? 0) * 100)}%`}
                                    {doneUpload && ' · uploaded'}
                                  </p>
                                </div>
                                {!uploadProgress && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeFile(i)
                                    }}
                                    aria-label={`Remove ${file.name}`}
                                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </motion.div>
                            )
                          })}
                          {!uploadProgress && (
                            <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-muted-foreground">
                              <span>
                                {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalFileBytes)}
                              </span>
                              <span className="flex gap-3">
                                <button type="button" className="text-brand hover:underline" onClick={() => fileInputRef.current?.click()}>
                                  add more
                                </button>
                                <button type="button" className="hover:text-foreground hover:underline" onClick={clearFiles}>
                                  clear
                                </button>
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-muted-foreground">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Drop files here</p>
                            <p className="text-xs text-muted-foreground">or click to browse — you can also paste an image</p>
                          </div>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            Max {formatBytes(maxFileBytes)} per file · up to {MAX_FILES_PER_BATCH} files
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <SidebarCard
                    {...sidebarProps}
                    hideLanguage
                    submitLabel={files.length > 1 ? `Upload ${files.length} files` : 'Upload file'}
                    onSubmit={handleUploadFiles}
                    submitDisabled={files.length === 0 || !canUpload}
                    submitIcon={<Upload className="h-4 w-4" />}
                  />
                  <AdSlot slot="sidebar" className="mt-4" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

/** Title / description / tags floating-label fields shared by both tabs. */
function MetaFields({
  idPrefix,
  titleLabel,
  title,
  setTitle,
  description,
  setDescription,
  tags,
  setTags,
}: {
  idPrefix: string
  titleLabel: string
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  tags: string
  setTags: (v: string) => void
}) {
  return (
    <>
      <div className="field">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder=" "
          aria-label={titleLabel}
          maxLength={255}
          className="field-input text-base font-medium"
          id={`${idPrefix}-title`}
        />
        <label htmlFor={`${idPrefix}-title`} className="field-float-label">
          {titleLabel}
        </label>
        <div className="field-bar" />
      </div>
      <div className="field">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder=" "
          aria-label="Description"
          maxLength={1000}
          className="field-input"
          id={`${idPrefix}-desc`}
        />
        <label htmlFor={`${idPrefix}-desc`} className="field-float-label">
          Description
        </label>
        <div className="field-bar" />
      </div>
      <div className="field">
        <Tag className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder=" "
          aria-label="Tags (comma separated)"
          className="field-input field-input-icon"
          id={`${idPrefix}-tags`}
        />
        <label
          htmlFor={`${idPrefix}-tags`}
          className="field-float-label"
          style={{ left: '2.25rem' }}
        >
          Tags (comma separated)
        </label>
        <div className="field-bar" />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar — language / visibility / password / burn / expiry + CTA   */
/* ------------------------------------------------------------------ */

/** Option state shared by both tabs' sidebars. */
type SidebarBaseProps = {
  user: SafeUser | null
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
  submitting: boolean
  onLogin: () => void
  limits: PlanLimits | null
  canPost: boolean
}

type SidebarCardProps = SidebarBaseProps & {
  language?: string
  setLanguage?: (v: string) => void
  submitLabel: string
  onSubmit: () => void
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
    onLogin,
    limits,
  } = props

  // Magnetic button effect
  const btnRef = useGsapMagnetic<HTMLButtonElement>(0.25)

  // Gating flags (based on plan limits)
  const canPrivate = limits ? limits.allowPrivate : false
  const canBurn = limits ? limits.allowBurnAfterRead : false
  const canPassword = limits ? limits.allowPassword : false
  const canCustomExpiry = limits ? limits.allowCustomExpiry : false
  const allowedPresets = limits ? limits.allowedExpiryPresets : ['never', '10m', '1h', '1d', '1w', '1M', '1y']
  const planName = limits?.name || '—'

  // If current selection is not allowed by plan, fall back to an allowed one
  useEffect(() => {
    if (limits && !allowedPresets.includes(expiryPreset) && !(expiryPreset === 'custom' && canCustomExpiry)) {
      setExpiryPreset(allowedPresets.includes('never') ? 'never' : allowedPresets[0] || 'never')
    }
    if (limits && !canBurn && burnAfterRead) setBurnAfterRead(false)
    if (limits && !canPassword && passwordEnabled) setPasswordEnabled(false)
    if (limits && !canPrivate && visibility === 'private') setVisibility('public')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limits, expiryPreset])

  return (
    <div className="surface-2 space-y-4 rounded-xl p-4">
      {/* Plan badge */}
      {limits && (
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface-3 px-2.5 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">plan</span>
          <span className="text-xs font-medium text-brand">{planName}</span>
        </div>
      )}

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
            const disabled = opt.value === 'private' && (!user || !canPrivate)
            const selected = visibility === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setVisibility(opt.value)}
                aria-pressed={selected}
                className={[
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all',
                  selected
                    ? 'border-brand bg-brand/5 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60',
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ].join(' ')}
              >
                <opt.icon
                  className={[
                    'h-3.5 w-3.5 transition-colors',
                    selected ? 'text-brand' : 'text-muted-foreground',
                  ].join(' ')}
                />
                <span className="flex-1 text-left">
                  {opt.label}
                  <span className="ml-1.5 hidden text-[11px] text-muted-foreground xl:inline">{opt.hint}</span>
                </span>
                {disabled && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {!user ? 'login' : 'upgrade'}
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
            disabled={burnAfterRead || !canPassword}
            className="data-[state=checked]:bg-brand"
          />
        </div>
        {!canPassword && (
          <p className="font-mono text-[10px] text-muted-foreground">Requires higher plan</p>
        )}
        {passwordEnabled && (
          <div className="field">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              className="field-input"
              id="paste-password"
              autoComplete="new-password"
            />
            <label htmlFor="paste-password" className="field-float-label">
              Password
            </label>
            <div className="field-bar" />
          </div>
        )}
      </div>

      {/* Burn after read */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="burn-switch"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <Flame className="h-3.5 w-3.5 text-muted-foreground" /> Burn after read
          </Label>
          <Switch
            id="burn-switch"
            checked={burnAfterRead}
            onCheckedChange={setBurnAfterRead}
            disabled={passwordEnabled || !canBurn}
            className="data-[state=checked]:bg-brand-2"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {canBurn ? 'Deleted after first view' : 'Requires higher plan'}
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
            {EXPIRY_OPTIONS.map((opt) => {
              const isCustom = opt.value === 'custom'
              const isAllowed = isCustom ? canCustomExpiry : allowedPresets.includes(opt.value)
              return (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={!isAllowed}
                  className={!isAllowed ? 'opacity-50' : ''}
                >
                  {opt.label}
                  {!isAllowed && <span className="ml-auto font-mono text-[9px] text-muted-foreground">upgrade</span>}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {expiryPreset === 'custom' && (
          <Input
            type="datetime-local"
            min={toLocalInputValue(new Date(Date.now() + 60_000))}
            value={expiryCustom}
            onChange={(e) => setExpiryCustom(e.target.value)}
            className="bg-surface-3"
            aria-label="Custom expiry date and time"
          />
        )}
      </div>

      {/* Submit — magnetic button */}
      <Button
        ref={btnRef}
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled || submitting}
        className="btn-shine relative w-full gap-1.5 overflow-hidden rounded-md bg-brand text-brand-foreground font-medium hover:bg-brand/90"
        size="lg"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
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
          for more features
        </p>
      )}
    </div>
  )
}

/** Date → value for <input type="datetime-local"> in the user's timezone. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
            <Reveal key={p.id} variant={fadeUp} className="h-full">
              <PasteCard paste={p} />
            </Reveal>
          ))}
        </StaggerGroup>
      )}
    </section>
  )
}
