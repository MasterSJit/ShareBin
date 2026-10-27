'use client'

import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  SearchX,
  Clock,
  Code2,
  Plus,
  Flame,
} from 'lucide-react'
import { PasteCard } from '@/components/paste-card'
import { AdSlot } from '@/components/ad-slot'
import { api, ApiError } from '@/lib/api-client'
import { languageLabel } from '@/lib/ui-utils'
import { useAppStore } from '@/lib/store'
import type { SafePaste } from '@/lib/types'
import { toast } from 'sonner'
import {
  Reveal,
  StaggerGroup,
  fadeUp,
} from '@/components/motion-helpers'
import { motion } from 'framer-motion'

const PAGE_SIZE = 12

type Scope = 'public' | 'trending' | 'language'

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof Clock }[] = [
  { value: 'public', label: 'Recent', icon: Clock },
  { value: 'trending', label: 'Trending', icon: Flame },
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      {/* ===== Page header ===== */}
      <Reveal className="mb-6">
        <span className="font-mono text-xs text-brand">{'>'} ls /public</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Browse
        </h1>
        <p className="mt-1 text-muted-foreground">
          Public pastes shared by the community.
        </p>
      </Reveal>

      {/* ===== Filter bar ===== */}
      <Reveal delay={0.05} className="mb-6">
        <div className="surface rounded-xl p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Search */}
            <div className="field relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, content, language, tags…"
                aria-label="Search pastes"
                className="field-input field-input-plain field-input-icon h-10"
              />
              <div className="field-bar" />
            </div>

            {/* Scope toggle */}
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => {
                if (v) setScope(v as Scope)
              }}
              aria-label="Browse scope"
              className="flex w-full items-center gap-1.5 md:w-auto"
            >
              {SCOPE_OPTIONS.map((opt) => {
                const active = scope === opt.value
                return (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    aria-label={opt.label}
                    className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors data-[state=off]:border-border data-[state=off]:text-muted-foreground md:flex-none ${
                      active
                        ? 'border-brand bg-brand/10 text-foreground'
                        : 'hover:text-foreground'
                    }`}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{opt.label}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>

            {/* Language picker (only in language scope) */}
            {scope === 'language' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-10 w-full border-border bg-surface-3 text-sm focus-visible:ring-brand sm:w-52">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.length === 0 ? (
                      <SelectItem value="plaintext">plaintext</SelectItem>
                    ) : (
                      languages.map((l) => (
                        <SelectItem key={l.language} value={l.language}>
                          {languageLabel(l.language)} ({l.count})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              title="Refresh"
              aria-label="Refresh results"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Between-cards sponsored slot ===== */}
      <AdSlot slot="between-cards" className="mb-6" />

      {/* ===== Body: results + sidebar ===== */}
      <div className="xl:grid xl:grid-cols-[1fr_240px] xl:gap-6">
        {/* Main results column */}
        <div className="min-w-0">
          {loading ? (
            <BrowseSkeleton />
          ) : error ? (
            <Reveal>
              <div className="surface flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <SearchX className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  className="gap-1.5 border-border hover:bg-surface-3"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            </Reveal>
          ) : pastes.length === 0 ? (
            <Reveal>
              <div className="surface flex flex-col items-center gap-4 rounded-xl p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-3">
                  <SearchX className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">No pastes found</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Try a different search term or filter, or create your own
                    paste to share.
                  </p>
                </div>
                <Button
                  onClick={goHome}
                  className="btn-shine mt-1 gap-1.5 bg-brand text-brand-foreground hover:bg-brand"
                >
                  <Plus className="h-4 w-4" /> Create one
                </Button>
              </div>
            </Reveal>
          ) : (
            <>
              {/* Grid */}
              <StaggerGroup
                stagger={0.05}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {pastes.map((p) => (
                  <Reveal key={p.id} variant={fadeUp} className="h-full">
                    <PasteCard paste={p} />
                  </Reveal>
                ))}
              </StaggerGroup>

              {/* Load more */}
              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="btn-shine gap-2 rounded-md bg-brand px-8 text-brand-foreground hover:bg-brand"
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
                </div>
              )}
            </>
          )}
        </div>

        {/* ===== Languages sidebar — hidden below xl ===== */}
        <aside className="hidden xl:block">
          <Reveal variant={fadeUp} delay={0.1}>
            <div className="surface sticky top-44 rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="brand-dot" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  top languages
                </span>
              </div>

              {topLanguages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No language data yet.
                </p>
              ) : (
                <StaggerGroup stagger={0.03} className="flex flex-col gap-0.5">
                  {topLanguages.map((l) => {
                    const active = scope === 'language' && language === l.language
                    return (
                      <Reveal key={l.language} variant={fadeUp}>
                        <button
                          type="button"
                          onClick={() => pickLanguage(l.language)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? 'bg-brand/10 text-brand'
                              : 'cursor-pointer hover:bg-surface-3'
                          }`}
                        >
                          <span className="truncate">{languageLabel(l.language)}</span>
                          <span className="ml-2 shrink-0 rounded bg-muted px-1.5 text-xs text-muted-foreground">
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

          <AdSlot slot="sidebar" className="mt-4" />
        </aside>
      </div>
    </div>
  )
}

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-44 rounded-xl bg-surface"
          aria-hidden
        />
      ))}
    </div>
  )
}
