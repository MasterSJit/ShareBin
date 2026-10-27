'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileArchive, Folder, FileText, Loader2, Lock, Search } from 'lucide-react'
import { formatBytes } from '@/lib/ui-utils'

type Entry = {
  name: string
  isDirectory: boolean
  size: number
  compressedSize: number
  method: number
  encrypted: boolean
  modifiedAt: string | null
}

type Listing = { total: number; truncated: boolean; limit: number; entries: Entry[] }

/** Browse a ZIP archive's contents and extract single files. */
export function ZipListing({ slug }: { slug: string }) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let active = true
    fetch(`/api/file/zip?id=${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then(async (r) => {
        const json = (await r.json()) as { message: string; data: Listing[] }
        if (!r.ok) throw new Error(json.message)
        if (active) setListing(json.data[0])
      })
      .catch((e: Error) => {
        if (active) setError(e.message || 'Could not read the archive')
      })
    return () => {
      active = false
    }
  }, [slug])

  const files = useMemo(() => {
    if (!listing) return []
    const q = filter.trim().toLowerCase()
    return listing.entries
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [listing, filter])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
        <FileArchive className="h-6 w-6" />
        {error}
      </div>
    )
  }
  if (!listing) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  const totalSize = listing.entries.reduce((s, e) => s + e.size, 0)
  const fileCount = listing.entries.filter((e) => !e.isDirectory).length

  return (
    <div className="bg-surface-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {fileCount} file{fileCount === 1 ? '' : 's'} · {formatBytes(totalSize)} uncompressed
          {listing.truncated && ` · showing first ${listing.limit} of ${listing.total}`}
        </span>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files"
            aria-label="Filter archive entries"
            className="h-7 w-44 rounded-md border border-border bg-surface-3 pl-6 pr-2 text-xs outline-none focus:border-brand"
          />
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-normal">Name</th>
              <th className="px-2 py-2 text-right font-normal">Size</th>
              <th className="hidden px-2 py-2 text-right font-normal sm:table-cell">Modified</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {files.map((e) => {
              const depth = e.name.replace(/\/$/, '').split('/').length - 1
              const label = e.name.replace(/\/$/, '').split('/').pop() || e.name
              const extractable = !e.isDirectory && !e.encrypted && (e.method === 0 || e.method === 8)
              return (
                <tr key={e.name} className="border-t border-border/50 hover:bg-surface-3/60">
                  <td className="px-4 py-1.5">
                    <span className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: `${Math.min(depth, 8) * 12}px` }} title={e.name}>
                      {e.isDirectory ? (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-brand" />
                      ) : e.encrypted ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-mono">{label}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-muted-foreground">
                    {e.isDirectory ? '—' : formatBytes(e.size)}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 text-right font-mono text-muted-foreground sm:table-cell">
                    {e.modifiedAt ? new Date(e.modifiedAt).toLocaleDateString() : ''}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {extractable && (
                      <a
                        href={`/api/file/zip?id=${encodeURIComponent(slug)}&entry=${encodeURIComponent(e.name)}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface-3 hover:text-brand"
                        title={`Extract ${label}`}
                        aria-label={`Extract ${label}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
            {files.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {filter ? 'No matching files' : 'Archive is empty'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
