import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  gone,
  tooManyRequests,
  unprocessable,
} from '@/lib/api-response'
import { getSession, hashPassword, clientIp } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import { generateUniqueSlug, getSetting } from '@/lib/paste-utils'
import {
  toSafePaste,
  findPaste,
  invalidatePasteRecord,
  checkPasteAccess,
  claimBurn,
  scheduleBurnDelete,
  recordView,
  canModerate,
} from '@/lib/paste-access'
import { contentDisposition } from '@/lib/paste-read'
import { getStorage, buildStorageKey } from '@/lib/storage'
import {
  getUserLimits,
  checkMonthlyLimit,
  checkStorageLimit,
  incrementMonthlyPastes,
  recomputeUsage,
} from '@/lib/rbac'
import { hardDeletePaste } from '@/lib/cleanup'
import { scanFileName, scanFileContent, mergeScanResults } from '@/lib/security-scan'
import {
  validateCreateOptions,
  getScanSettings,
  isFileTypeAllowed,
  siteBaseUrl,
  pasteLinks,
} from '@/lib/paste-create'
import { formatBytesServer } from '@/lib/format'

function field(form: FormData, name: string): string | undefined {
  const v = form.get(name)
  return typeof v === 'string' ? v : undefined
}

function normaliseTags(tags: string | undefined): string | null {
  if (!tags) return null
  const cleaned = [...new Set(tags.split(',').map((t) => t.trim().replace(/^#/, '').slice(0, 40)).filter(Boolean))]
  return cleaned.length ? cleaned.slice(0, 20).join(',') : null
}

// PUT /api/file — multipart upload (POST is an alias)
export async function PUT(req: NextRequest) {
  const session = await getSession()

  const guestOk = await getSetting<boolean>('guestPostingEnabled')
  if (guestOk === false && !session) return forbidden('Guest uploads are disabled. Please log in.')

  // ---- Plan limits ----
  const limits = await getUserLimits(session?.userId ?? null)
  if (!limits.allowFileUpload) {
    return forbidden(
      session
        ? `File uploads are not included in the ${limits.planName} plan`
        : 'File uploads require an account. Please log in or register.',
    )
  }

  const rateKey = session ? `file:u:${session.userId}` : `file:ip:${clientIp(req.headers)}`
  if (rateLimitHit(rateKey, 20, 60_000)) {
    return tooManyRequests('Too many uploads. Slow down.')
  }

  const scanCfg = await getScanSettings()
  const maxBytes = Math.min(limits.maxPasteSize, scanCfg.maxFileSizeBytes)

  // Reject obviously oversized bodies before buffering them.
  const declared = Number(req.headers.get('content-length') || 0)
  if (declared && declared > maxBytes + 1024 * 1024) {
    return new Response(
      JSON.stringify({ message: `File too large (max ${formatBytesServer(maxBytes)})`, data: [] }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('file field is required')
  if (file.size === 0) return badRequest('File is empty')
  const fileName = (file.name || 'upload').slice(0, 255)
  const mimeType = (file.type || 'application/octet-stream').slice(0, 100)

  // Per-file size limit (smaller of plan limit and site-wide limit)
  if (file.size > maxBytes) {
    return forbidden(`File too large (${formatBytesServer(file.size)}, max ${formatBytesServer(maxBytes)} on ${limits.planName} plan)`)
  }

  if (!isFileTypeAllowed(scanCfg.allowedFileTypes, mimeType, fileName)) {
    return unprocessable(`File type ${mimeType} is not allowed on this site`)
  }

  // Storage limit check
  const canStore = await checkStorageLimit(session?.userId ?? null, file.size, limits)
  if (!canStore) {
    return forbidden(`Storage limit exceeded (${formatBytesServer(limits.maxStorageBytes)} on ${limits.planName} plan)`)
  }

  // Monthly paste limit
  const canCreate = await checkMonthlyLimit(session?.userId ?? null, limits)
  if (!canCreate) {
    return tooManyRequests(`Monthly paste limit reached (${limits.maxPastesPerMonth} on ${limits.planName} plan)`)
  }

  const validated = await validateCreateOptions(
    {
      visibility: field(form, 'visibility'),
      password: field(form, 'password'),
      burnAfterRead: field(form, 'burnAfterRead') === 'true' || field(form, 'burnAfterRead') === '1',
      expiryPreset: field(form, 'expiryPreset'),
      expiryCustom: field(form, 'expiryCustom'),
    },
    session,
    limits,
  )
  if (!validated.ok) return validated.response
  const opts = validated.options

  const buf = Buffer.from(await file.arrayBuffer())

  // ---- Spam / malware scan (file name + MIME + bytes) ----
  if (scanCfg.enabled) {
    const merged = mergeScanResults([
      scanFileName(fileName, mimeType, { bannedExtensions: scanCfg.bannedExtensions }),
      scanFileContent(buf, mimeType, { strict: scanCfg.strict }),
    ])
    if (!merged.safe) {
      return unprocessable('File rejected by spam/malware scanner', [{ threats: merged.threats }])
    }
  }

  const storageKey = buildStorageKey(fileName)
  await getStorage().upload(storageKey, buf, mimeType)

  const passwordHash = opts.password ? await hashPassword(opts.password) : null

  let paste
  try {
    paste = await db.paste.create({
      data: {
        ownerId: session?.userId ?? null,
        title: field(form, 'title')?.trim().slice(0, 255) || null,
        description: field(form, 'description')?.trim().slice(0, 1000) || null,
        tags: normaliseTags(field(form, 'tags')),
        slug: await generateUniqueSlug(),
        contentType: 'file',
        language: 'plaintext',
        storageDriver: 'local',
        storageKey,
        originalFileName: fileName,
        mimeType,
        fileSizeBytes: file.size,
        visibility: opts.visibility,
        passwordHash,
        burnAfterRead: opts.burnAfterRead,
        expiresAt: opts.expiresAt,
      },
      include: { owner: true },
    })
  } catch (e) {
    // Don't leave an orphaned file behind if the DB write fails.
    await getStorage().delete(storageKey)
    throw e
  }

  if (session) {
    await incrementMonthlyPastes(session.userId)
    await recomputeUsage(session.userId).catch(() => {})
    invalidatePasteRecord(paste)
  }

  const links = pasteLinks(await siteBaseUrl(req), paste)
  if (new URL(req.url).searchParams.get('format') === 'url') {
    return new Response(links.url + '\n', {
      status: 201,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return created('File uploaded successfully', [
    { ...toSafePaste(paste, { includeContent: false }), ...links },
  ])
}

export const POST = PUT

// MIME types the browser may render inline (everything else is forced to download).
function inlineKind(mime: string): 'image' | 'svg' | 'media' | 'pdf' | 'text' | null {
  if (mime === 'image/svg+xml') return 'svg'
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/.test(mime)) return 'image'
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return 'text'
  return null
}

// Locks down anything rendered from user uploads: no scripts, no plugins,
// no network access, and an opaque origin (sandbox) so it can't touch ours.
const SANDBOX_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"

/**
 * GET /api/file?id=<slug> — download file bytes.
 *   &meta=1    metadata only (JSON envelope)
 *   &inline=1  render in the browser when the type is safe (previews); does
 *              not count a view. Not available for burn-after-read files.
 * Supports `Range: bytes=…` for audio/video seeking (not for burn files).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const meta = searchParams.get('meta') === '1'
  const wantInline = searchParams.get('inline') === '1'
  if (!id) return badRequest('id is required')

  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return notFound('File not found')
  if (paste.contentType !== 'file' || !paste.storageKey) return badRequest('Not a file paste')

  const access = await checkPasteAccess(req, paste, session)
  if (access.status === 'denied') return access.response
  if (access.status === 'password_required') {
    if (meta) return ok('Password required', [{ ...toSafePaste(paste), passwordRequired: true }])
    return forbidden('Password required — POST /api/paste/unlock first')
  }

  const privileged = access.isOwner || access.isModerator
  const burnPending = paste.burnAfterRead && !privileged

  if (meta) {
    return ok('File metadata', [{ ...toSafePaste(paste), isOwner: access.isOwner, burnPending }])
  }

  const mime = (paste.mimeType || 'application/octet-stream').toLowerCase()
  const kind = inlineKind(mime)
  const inline = wantInline && !!kind && !burnPending
  const fileName = paste.originalFileName || paste.slug
  const storage = getStorage()
  const total = paste.fileSizeBytes ?? 0

  const headers: Record<string, string> = {
    // Text is always served as text/plain so uploaded HTML/JS never renders.
    'Content-Type': inline && kind === 'text' ? 'text/plain; charset=utf-8' : mime,
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', fileName),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': burnPending ? 'none' : 'bytes',
  }
  if (kind !== 'pdf') headers['Content-Security-Policy'] = SANDBOX_CSP

  // ---- burn-after-read: exactly one successful download, then delete ----
  if (burnPending) {
    if (wantInline) {
      return new Response(
        JSON.stringify({ message: 'Burn-after-read files can only be downloaded once (no inline preview)', data: [] }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (!(await claimBurn(paste))) return gone('File was burned after reading and is no longer available')
    let buf: Buffer
    try {
      buf = await storage.download(paste.storageKey)
    } finally {
      scheduleBurnDelete(paste.id)
    }
    headers['Content-Length'] = String(buf.length)
    return new Response(new Uint8Array(buf), { status: 200, headers })
  }

  // ---- Range requests (video/audio seeking) ----
  const range = req.headers.get('range')
  const m = range && total > 0 ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : total - parseInt(m[2], 10)
    let end = m[1] && m[2] ? parseInt(m[2], 10) : total - 1
    start = Math.max(0, start)
    end = Math.min(end, total - 1)
    if (start > end || start >= total) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
    }
    const chunk = await storage.readRange(paste.storageKey, start, end)
    if (start === 0 && !inline && !privileged) await recordView(paste)
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${total}`,
        'Content-Length': String(chunk.length),
      },
    })
  }

  let buf: Buffer
  try {
    buf = await storage.download(paste.storageKey)
  } catch {
    return notFound('File data is missing from storage')
  }
  // Previews (inline) don't count — the paste page view already did.
  if (!inline && !privileged) await recordView(paste)
  headers['Content-Length'] = String(buf.length)
  return new Response(new Uint8Array(buf), { status: 200, headers })
}

// DELETE /api/file?id=slug — delete own file
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const { searchParams } = new URL(req.url)
  let body: { id?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* allow empty */
  }
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  })
  if (!paste) return notFound('File not found')
  if (paste.contentType !== 'file') return badRequest('Not a file paste')
  const isOwner = paste.ownerId === session.userId
  if (!isOwner && !(await canModerate(session))) {
    return forbidden('Not the owner')
  }

  // Hard-delete (storage file + record + grants)
  await hardDeletePaste(paste.id, isOwner ? 'owner' : 'admin', session.userId)
  return ok('File permanently deleted', [])
}
