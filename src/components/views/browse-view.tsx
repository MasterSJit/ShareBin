'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  RefreshCw,
  Compass,
  FileSearch,
  TrendingUp,
  Clock,
  Code2,
  Plus,
  AlertCircle,
} from 'lucide-react'
import { PasteCard } from '@/components/paste-card'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { SafePaste } from '@/lib/types'
import { toast } from 'sonner'

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Compass className="h-7 w-7 text-primary" />
          Browse Pastes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Discover public code &amp; files shared by the community.
        </p>
      </div>

      {/* Filter bar */}
      <Card className="mb-6 sticky top-16 z-20 rounded-xl border-border/70 bg-card/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <CardContent className="flex flex-col gap-3 px-4 py-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, content, language, tags…"
                className="pl-9"
                aria-label="Search pastes"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              title="Refresh"
              aria-label="Refresh results"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => {
                if (v) setScope(v as Scope)
              }}
              variant="outline"
              size="sm"
              aria-label="Browse scope"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value} className="gap-1.5">
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {scope === 'language' && (
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full sm:w-56" size="sm">
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Body: results + sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        {/* Main results column */}
        <div className="min-w-0">
          {loading ? (
            <BrowseSkeleton />
          ) : error ? (
            <Card className="border-destructive/40">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={refresh}>
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </CardContent>
            </Card>
          ) : pastes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <FileSearch className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-medium">No pastes found</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try a different search term or filter, or create your own paste to share.
                </p>
                <Button onClick={goHome} className="mt-1 gap-1.5">
                  <Plus className="h-4 w-4" /> Create a paste
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {scope === 'trending'
                    ? 'Trending '
                    : scope === 'language'
                      ? `Top ${language} `
                      : 'Recent '}
                  pastes
                  {debouncedQuery && (
                    <>
                      {' '}
                      matching <span className="font-medium text-foreground">&ldquo;{debouncedQuery}&rdquo;</span>
                    </>
                  )}
                </span>
                <span>{showingCount} shown</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {pastes.map((p) => (
                  <PasteCard key={p.id} paste={p} />
                ))}
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                {hasMore ? (
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ve reached the end — {showingCount} paste
                    {showingCount === 1 ? '' : 's'} shown.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Languages sidebar — hidden below xl */}
        <aside className="hidden xl:block">
          <Card className="sticky top-32 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Code2 className="h-4 w-4 text-primary" /> Top Languages
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {topLanguages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No language data yet.</p>
              ) : (
                topLanguages.map((l) => {
                  const active = scope === 'language' && language === l.language
                  return (
                    <Badge
                      key={l.language}
                      variant={active ? 'default' : 'secondary'}
                      className="cursor-pointer select-none transition hover:opacity-80"
                      onClick={() => pickLanguage(l.language)}
                    >
                      {l.language}
                      <span className="ml-1 opacity-70">· {l.count}</span>
                    </Badge>
                  )
                })
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function BrowseSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="gap-0">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-full" />
          </CardHeader>
          <CardContent className="pb-3">
            <Skeleton className="h-16 w-full rounded-md" />
          </CardContent>
          <CardContent className="flex gap-3 pt-0">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
