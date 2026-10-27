'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Loader2, Flame, Music, Maximize2, FileArchive, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api-client'
import { formatBytes } from '@/lib/ui-utils'
import { ZipListing } from '@/components/zip-listing'

type Props = {
  slug: string
  fileName: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  /** Downloading will destroy the file (burn-after-read, caller isn't the owner). */
  burnPending: boolean
}

type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'zip' | 'other'

const TEXT_PREVIEW_LIMIT = 512 * 1024

function fileKind(mime: string, name: string): Kind {
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon)$/.test(mime)) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed' || /\.(zip|jar|apk|docx|xlsx|pptx|odt|epub)$/i.test(name)) {
    return 'zip'
  }
  if (mime.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript', 'application/x-yaml'].includes(mime)) {
    return 'text'
  }
  return 'other'
}

/**
 * Inline preview for supported file types (image, video, audio, PDF, text,
 * ZIP listing). Password gating is handled by the parent PasteView — by the
 * time this renders the unlock cookie is set, so <img>/<video> URLs work.
 *
 * Burn-after-read files can only be fetched once, so they are downloaded as
 * a blob on an explicit click and previewed from memory.
 */
export function FilePreview({ slug, fileName, mimeType, fileSizeBytes, burnPending }: Props) {
  const type = (mimeType || '').toLowerCase()
  const name = fileName || slug
  const kind = fileKind(type, name)
  const previewUrl = api.filePreviewUrl(slug)
  const downloadUrl = api.fileDownloadUrl(slug)

  if (burnPending) {
    return <BurnFile slug={slug} name={name} kind={kind} mime={type} size={fileSizeBytes} />
  }

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <PreviewHeader label={`${kind === 'other' ? 'file' : kind} preview`} size={fileSizeBytes} openUrl={kind === 'other' || kind === 'zip' ? null : previewUrl} />
      <PreviewBody kind={kind} src={previewUrl} name={name} mime={type} size={fileSizeBytes} slug={slug} />
      <FileActions fileName={name} downloadUrl={downloadUrl} />
    </div>
  )
}

function PreviewHeader({ label, size, openUrl }: { label: string; size: number | null; openUrl: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
        {formatBytes(size)}
        {openUrl && (
          <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground" title="Open in a new tab">
            <Maximize2 className="h-3 w-3" /> open
          </a>
        )}
      </span>
    </div>
  )
}

function PreviewBody({
  kind,
  src,
  name,
  mime,
  size,
  slug,
}: {
  kind: Kind
  src: string
  name: string
  mime: string
  size: number | null
  /** Only needed for server-side listings (zip); omit for blob previews. */
  slug?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        Preview unavailable — download the file instead.
      </div>
    )
  }

  if (kind === 'image') {
    return (
      <div className="flex items-center justify-center bg-surface-2 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} onError={() => setFailed(true)} className="max-h-[600px] max-w-full rounded-lg object-contain" />
      </div>
    )
  }
  if (kind === 'video') {
    return (
      <div className="bg-black">
        <video src={src} controls preload="metadata" onError={() => setFailed(true)} className="mx-auto max-h-[600px] max-w-full">
          Your browser does not support video playback.
        </video>
      </div>
    )
  }
  if (kind === 'audio') {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Music className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium">{name}</p>
        <audio src={src} controls preload="metadata" onError={() => setFailed(true)} className="w-full max-w-md">
          Your browser does not support audio playback.
        </audio>
      </div>
    )
  }
  if (kind === 'pdf') {
    return <iframe src={src} className="h-[600px] w-full bg-surface-2" title={name} />
  }
  if (kind === 'text') {
    return <TextPreview src={src} size={size} />
  }
  if (kind === 'zip' && slug) {
    return <ZipListing slug={slug} />
  }
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        {kind === 'zip' ? <FileArchive className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
      </div>
      <div>
        <p className="text-lg font-semibold break-all">{name}</p>
        <p className="text-sm text-muted-foreground">
          {mime || 'Unknown type'} · {formatBytes(size)}
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">No inline preview available for this file type.</p>
    </div>
  )
}

function TextPreview({ src, size }: { src: string; size: number | null }) {
  const [text, setText] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let active = true
    const headers: HeadersInit = size && size > TEXT_PREVIEW_LIMIT ? { Range: `bytes=0-${TEXT_PREVIEW_LIMIT - 1}` } : {}
    fetch(src, { credentials: 'include', headers })
      .then(async (r) => {
        if (!r.ok && r.status !== 206) throw new Error(String(r.status))
        const t = await r.text()
        if (!active) return
        setTruncated(r.status === 206)
        setText(t)
      })
      .catch(() => {
        if (active) setText('Failed to load text content.')
      })
    return () => {
      active = false
    }
  }, [src, size])

  return (
    <div className="max-h-[500px] overflow-auto bg-surface-2 p-4">
      {text === null ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">{text}</pre>
          {truncated && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              … showing the first {formatBytes(TEXT_PREVIEW_LIMIT)} — download for the full file.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function FileActions({ fileName, downloadUrl }: { fileName: string; downloadUrl: string }) {
  return (
    <div className="flex justify-end border-t border-border px-4 py-3">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
        <a href={downloadUrl} download={fileName}>
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      </Button>
    </div>
  )
}

/** Burn-after-read: one explicit download, then preview from memory. */
function BurnFile({ slug, name, kind, mime, size }: { slug: string; name: string; kind: Kind; mime: string; size: number | null }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  function saveBlob(url: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function downloadOnce() {
    setState('loading')
    setError(null)
    try {
      const blob = await api.fetchFileBlob(slug)
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      saveBlob(url)
      setState('done')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Download failed')
      setState('error')
    }
  }

  if (state === 'done' && blobUrl) {
    return (
      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-brand-2/30 bg-brand-2/5 px-4 py-2 text-xs">
          <Flame className="h-3.5 w-3.5 text-brand-2" />
          <span>This file has been deleted from the server. The copy below only exists in this tab.</span>
        </div>
        {kind !== 'other' && kind !== 'zip' && <PreviewBody kind={kind} src={blobUrl} name={name} mime={mime} size={size} />}
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => saveBlob(blobUrl)}>
            <Download className="h-3.5 w-3.5" /> Save again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="surface flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-2/15 text-brand-2">
        <Flame className="h-6 w-6" />
      </div>
      <div>
        <p className="text-lg font-semibold break-all">{name}</p>
        <p className="text-sm text-muted-foreground">
          {mime || 'Unknown type'} · {formatBytes(size)}
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        This file is set to <span className="text-brand-2">burn after reading</span>: it can be downloaded exactly once and is
        then permanently deleted.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={downloadOnce} disabled={state === 'loading'} className="btn-shine gap-1.5 bg-brand-2 text-white hover:bg-brand-2/90">
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download &amp; burn
      </Button>
    </div>
  )
}
