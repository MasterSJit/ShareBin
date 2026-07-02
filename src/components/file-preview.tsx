'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, markUnlocked } from '@/lib/api-client'
import { formatBytes } from '@/lib/ui-utils'

type Props = {
  slug: string
  fileName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  hasPassword: boolean
  isOwner: boolean
  isBurned: boolean
}

/**
 * Inline preview for supported file types (image, video, audio, PDF, text).
 * Falls back to a download card for unsupported types.
 */
export function FilePreview({
  slug,
  fileName,
  mimeType,
  fileSizeBytes,
  hasPassword,
  isOwner,
  isBurned,
}: Props) {
  const [unlocked, setUnlocked] = useState(isOwner || !hasPassword)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Determine file category from MIME type
  const type = mimeType || ''
  const isImage = type.startsWith('image/')
  const isVideo = type.startsWith('video/')
  const isAudio = type.startsWith('audio/')
  const isPdf = type === 'application/pdf'
  const isText = type.startsWith('text/') || type === 'application/json'
  const downloadUrl = api.fileDownloadUrl(slug)

  // For text files, fetch and display content
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)

  useEffect(() => {
    if (!unlocked || !isText) return
    let active = true
    setTextLoading(true)
    fetch(downloadUrl, { headers: { 'x-unlocked': unlocked ? slug : '' } })
      .then((r) => r.text())
      .then((t) => { if (active) setTextContent(t) })
      .catch(() => { if (active) setTextContent('Failed to load text content.') })
      .finally(() => { if (active) setTextLoading(false) })
    return () => { active = false }
  }, [unlocked, isText, downloadUrl, slug])

  // Password gate
  if (!unlocked) {
    return (
      <div className="surface flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand animate-glow-pulse">
          <LockIcon />
        </div>
        <div>
          <p className="text-lg font-semibold">Password protected</p>
          <p className="text-sm text-muted-foreground">Enter the password to preview this file</p>
        </div>
        <div className="flex w-full max-w-xs gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="field-input h-10 flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock() }}
          />
          <Button onClick={handleUnlock} disabled={loading} className="btn-shine bg-brand text-brand-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Burned file
  if (isBurned) {
    return (
      <div className="surface flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-2/15 text-brand-2">
          <FlameIcon />
        </div>
        <div>
          <p className="text-lg font-semibold">File burned</p>
          <p className="text-sm text-muted-foreground">This file was permanently deleted after reading.</p>
        </div>
      </div>
    )
  }

  async function handleUnlock() {
    setLoading(true)
    setError(null)
    try {
      await api.unlockPaste(slug, password)
      markUnlocked(slug)
      setUnlocked(true)
    } catch {
      setError('Incorrect password')
    } finally {
      setLoading(false)
    }
  }

  // ---- Previews ----

  if (isImage) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">image preview</span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(fileSizeBytes)}</span>
        </div>
        <div className="flex items-center justify-center bg-surface-2 p-4">
          <img
            src={downloadUrl}
            alt={fileName || 'image'}
            className="max-h-[600px] max-w-full rounded-lg object-contain"
          />
        </div>
        <FileActions fileName={fileName} downloadUrl={downloadUrl} />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">video preview</span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(fileSizeBytes)}</span>
        </div>
        <div className="bg-black">
          <video
            src={downloadUrl}
            controls
            className="mx-auto max-h-[600px] max-w-full"
          >
            Your browser does not support video playback.
          </video>
        </div>
        <FileActions fileName={fileName} downloadUrl={downloadUrl} />
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">audio preview</span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(fileSizeBytes)}</span>
        </div>
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
            <MusicIcon />
          </div>
          <p className="text-sm font-medium">{fileName}</p>
          <audio src={downloadUrl} controls className="w-full max-w-md">
            Your browser does not support audio playback.
          </audio>
        </div>
        <FileActions fileName={fileName} downloadUrl={downloadUrl} />
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">pdf preview</span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(fileSizeBytes)}</span>
        </div>
        <iframe
          src={downloadUrl}
          className="h-[600px] w-full bg-surface-2"
          title={fileName || 'PDF preview'}
        />
        <FileActions fileName={fileName} downloadUrl={downloadUrl} />
      </div>
    )
  }

  if (isText) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">text preview</span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(fileSizeBytes)}</span>
        </div>
        <div className="max-h-[500px] overflow-auto bg-surface-2 p-4">
          {textLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all">{textContent}</pre>
          )}
        </div>
        <FileActions fileName={fileName} downloadUrl={downloadUrl} />
      </div>
    )
  }

  // Unsupported — download card
  return (
    <div className="surface flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <FileText className="h-8 w-8" />
      </div>
      <div>
        <p className="text-lg font-semibold">{fileName}</p>
        <p className="text-sm text-muted-foreground">
          {type || 'Unknown type'} · {formatBytes(fileSizeBytes)}
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        No inline preview available for this file type.
      </p>
      <a href={downloadUrl} download={fileName || undefined}>
        <Button className="btn-shine bg-brand text-brand-foreground">
          <Download className="h-4 w-4" /> Download
        </Button>
      </a>
    </div>
  )
}

function FileActions({ fileName, downloadUrl }: { fileName: string | null; downloadUrl: string }) {
  return (
    <div className="border-t border-border px-4 py-3 flex justify-end">
      <a href={downloadUrl} download={fileName || undefined}>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </a>
    </div>
  )
}

// Inline icons to avoid extra imports
function LockIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
function FlameIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 6.657c.5.79.657 1.5.657 2.343v0a8 8 0 01-1.657 5.657z" />
    </svg>
  )
}
function MusicIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  )
}
