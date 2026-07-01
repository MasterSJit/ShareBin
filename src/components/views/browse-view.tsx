'use client'

import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Search,
  RefreshCw,
  Compass,
  SearchX,
  TrendingUp,
  Clock,
  Code2,
  Plus,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { PasteCard } from '@/components/paste-card'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { SafePaste } from '@/lib/types'
import { toast } from 'sonner'
import {
  Reveal,
  StaggerGroup,
  scaleIn,
  slideInRight,
} from '@/components/motion-helpers'
import { motion } from 'framer-motion'

const PAGE_SIZE = 12

type Scope = 'public' | 'trending' | 'language'

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof Clock }[] = [
  { value: 'public', label: 'Recent', icon: Clock },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
  { value: 'language', label: 'By Language', icon: Code2 },
]

export function BrowseView() {
  const goHome = useAppStore((s) => s.goHome)

  const [scope, setScope] = useState<Scope>('public')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [page, setPage] = useState(1)

  const [pastes, setPastes] = useState<SafePaste[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [languages, setLanguages] = useState<{ language: string; count: number }[]>([])
  const [refreshNonce, setRefreshNonce] = useState(0)

  // Debounce the search input (300ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Load the languages list (once and on manual refresh).
  useEffect(() => {
    let alive = true
    api
      .listLanguages()
      .then((list) => {
        if (alive) setLanguages(list)
      })
      .catch(() => {
        /* sidebar is optional — ignore */
      })
    return () => {
      alive = false
    }
  }, [refreshNonce])

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      try {
        const list = await api.listPastes({
          scope,
          q: debouncedQuery || undefined,
          language: scope === 'language' ? language : undefined,
          page: pageNum,
          pageSize: PAGE_SIZE,
        })
        setPastes((prev) => (replace ? list : [...prev, ...list]))
        setHasMore(list.length === PAGE_SIZE)
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Failed to load pastes'
        setError(msg)
        if (replace) setPastes([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [scope, debouncedQuery, language],
  )

  // Reset to page 1 and refetch whenever the active filters change.
  useEffect(() => {
    setPage(1)
    fetchPage(1, true)
  }, [scope, debouncedQuery, language, refreshNonce, fetchPage])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPage(next, false)
  }

  const refresh = () => {
    setRefreshNonce((n) => n + 1)
    toast.success('Refreshed')
  }

  const pickLanguage = (lang: string) => {
    setScope('language')
    setLanguage(lang)
  }

  const topLanguages = languages.slice(0, 12)
  const showingCount = pastes.length

  const scopeLabel =
    scope === 'trending'
      ? 'Trending'
      : scope === 'language'
        ? `Top ${language}`
        : 'Recent'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ===== Page header ===== */}
      <Reveal className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
              <Compass className="h-6 w-6 text-brand-foreground" />
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand to-brand-2 opacity-50 blur-lg" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="text-gradient-animated">Browse Pastes</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
                Discover public code &amp; files shared by the community.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full glass px-4 py-2 text-xs text-muted-foreground sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>
              <span className="font-semibold text-foreground">{languages.reduce((s, l) => s + l.count, 0)}</span>{' '}
              public pastes · {languages.length} languages
            </span>
          </div>
        </div>
      </Reveal>

      {/* ===== Filter bar (sticky) ===== */}
      <Reveal delay={0.05} className="mb-6">
        <div className="glass-strong gradient-border sticky top-20 z-20 rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            {/* Search row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, content, language, tags…"
                  className="h-11 border-transparent bg-muted/30 pl-10 text-base focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Search pastes"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                title="Refresh"
                aria-label="Refresh results"
                className="btn-shine h-11 w-11 shrink-0 border-border/60 bg-muted/30 hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Scope toggle row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <ToggleGroup
                type="single"
                value={scope}
                onValueChange={(v) => {
                  if (v) setScope(v as Scope)
                }}
                aria-label="Browse scope"
                className="flex flex-wrap gap-2 rounded-xl bg-muted/20 p-1"
              >
                {SCOPE_OPTIONS.map((opt) => {
                  const active = scope === opt.value
                  return (
                    <ToggleGroupItem
                      key={opt.value}
                      value={opt.value}
                      aria-label={opt.label}
                      className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                        active
                          ? 'bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30'
                          : 'glass text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>

              {scope === 'language' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full border-border/60 bg-muted/30 focus-visible:ring-brand sm:w-56">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.length === 0 ? (
                        <SelectItem value="plaintext">plaintext</SelectItem>
                      ) : (
                        languages.map((l) => (
                          <SelectItem key={l.language} value={l.language}>
                            {l.language} ({l.count})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Body: results + sidebar ===== */}
      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        {/* Main results column */}
        <div className="min-w-0">
          {loading ? (
            <BrowseSkeleton />
          ) : error ? (
            <Reveal>
              <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center border-destructive/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  className="gap-1.5 border-border/60 hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            </Reveal>
          ) : pastes.length === 0 ? (
            <Reveal>
              <div className="glass flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand/15 to-brand-2/15">
                  <SearchX className="h-9 w-9 text-muted-foreground" />
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-brand/5 blur-xl" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">No pastes found</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Try a different search term or filter, or create your own paste to share with the community.
                  </p>
                </div>
                <Button
                  onClick={goHome}
                  className="btn-shine mt-1 gap-1.5 bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/30 hover:shadow-brand/50"
                >
                  <Plus className="h-4 w-4" /> Create one
                </Button>
              </div>
            </Reveal>
          ) : (
            <>
              {/* Result summary */}
              <Reveal className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{scopeLabel}</span> pastes
                    {debouncedQuery && (
                      <>
                        {' '}
                        matching{' '}
                        <span className="font-medium text-foreground">
                          &ldquo;{debouncedQuery}&rdquo;
                        </span>
                      </>
                    )}
                  </span>
                  <span className="rounded-full bg-muted/40 px-2.5 py-0.5 font-mono">
                    {showingCount} shown
                  </span>
                </div>
              </Reveal>

              {/* Grid */}
              <StaggerGroup
                stagger={0.06}
                className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
              >
                {pastes.map((p) => (
                  <Reveal key={p.id} variant={scaleIn}>
                    <PasteCard paste={p} />
                  </Reveal>
                ))}
              </StaggerGroup>

              {/* Load more */}
              <div className="mt-8 flex flex-col items-center gap-2">
                {hasMore ? (
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="btn-shine gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-8 text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:shadow-brand/50"
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Load more
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ve reached the end —{' '}
                    <span className="font-semibold text-foreground">{showingCount}</span> paste
                    {showingCount === 1 ? '' : 's'} shown.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ===== Languages sidebar — hidden below xl ===== */}
        <aside className="hidden xl:block">
          <Reveal variant={slideInRight} className="sticky top-44">
            <div className="glass rounded-2xl p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-brand" />
                  <h2 className="text-sm font-semibold">Top Languages</h2>
                </div>
                <div className="mt-2 h-0.5 w-full rounded-full bg-gradient-to-r from-brand to-brand-2 opacity-60" />
              </div>

              {topLanguages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No language data yet.</p>
              ) : (
                <StaggerGroup stagger={0.04} className="flex flex-col gap-2">
                  {topLanguages.map((l) => {
                    const active = scope === 'language' && language === l.language
                    return (
                      <Reveal key={l.language} variant={scaleIn}>
                        <button
                          type="button"
                          onClick={() => pickLanguage(l.language)}
                          className={`lift glow-brand-hover flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-all duration-300 ${
                            active
                              ? 'bg-brand/15 text-brand'
                              : 'glass text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate font-mono">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                active ? 'bg-brand' : 'bg-brand-2/60'
                              }`}
                            />
                            {l.language}
                          </span>
                          <span
                            className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              active
                                ? 'bg-brand/20 text-brand'
                                : 'bg-muted/40 text-muted-foreground'
                            }`}
                          >
                            {l.count}
                          </span>
                        </button>
                      </Reveal>
                    )
                  })}
                </StaggerGroup>
              )}
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  )
}

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="shimmer glass rounded-2xl p-5"
          style={{ height: '13rem' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="h-5 w-2/3 rounded bg-muted/40" />
            <div className="h-5 w-14 rounded bg-muted/40" />
          </div>
          <div className="mt-3 h-3 w-full rounded bg-muted/30" />
          <div className="mt-2 h-3 w-3/4 rounded bg-muted/30" />
          <div className="mt-5 h-16 w-full rounded-lg bg-muted/25" />
          <div className="mt-4 flex gap-3">
            <div className="h-3 w-14 rounded bg-muted/30" />
            <div className="h-3 w-14 rounded bg-muted/30" />
            <div className="h-3 w-14 rounded bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  )
}
