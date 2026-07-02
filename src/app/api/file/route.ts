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
} from '@/lib/api-response'
import { getSession, hashPassword } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import {
  generateUniqueSlug,
  computeExpiry,
  isExpired,
  VISIBILITY,
  getSetting,
} from '@/lib/paste-utils'
import { toSafePaste, invalidatePaste, invalidateUserPastes, findPaste } from '@/lib/paste-access'
import { getStorage, buildStorageKey } from '@/lib/storage'
import { getUserLimits, isExpiryAllowed, checkMonthlyLimit, checkStorageLimit, incrementMonthlyPastes } from '@/lib/rbac'

// PUT /api/file — multipart upload
export async function PUT(req: NextRequest) {
  const session = await getSession()

  const guestOk = await getSetting<boolean>('guestPostingEnabled')
  if (!guestOk && !session) return forbidden('Guest uploads are disabled. Please log in.')

  // ---- Plan limits ----
  const limits = await getUserLimits(session?.userId ?? null)
  if (!limits.allowFileUpload && !session) {
    return forbidden('File uploads require login and a paid plan')
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (rateLimitHit(`file:${ip}`, 20, 60_000)) {
    return tooManyRequests('Too many uploads. Slow down.')
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Expected multipart/form-data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('file field is required')

  // Per-file size limit from plan
  if (file.size > limits.maxPasteSize) {
    return forbidden(`File too large (max ${limits.maxPasteSize} bytes on ${limits.planName} plan)`)
  }

  // Storage limit check
  const canStore = await checkStorageLimit(session?.userId ?? null, file.size, limits)
  if (!canStore) {
    return forbidden(`Storage limit exceeded (${limits.maxStorageBytes} bytes on ${limits.planName} plan)`)
  }

  // Monthly paste limit
  const canCreate = await checkMonthlyLimit(session?.userId ?? null, limits)
  if (!canCreate) {
    return tooManyRequests(`Monthly paste limit reached (${limits.maxPastesPerMonth} on ${limits.planName} plan)`)
  }

  const visibility = (VISIBILITY as readonly string[]).includes(String(form.get('visibility') || ''))
    ? String(form.get('visibility'))
    : 'public'
  if (visibility === 'private') {
    if (!session) return forbidden('Private files require login')
    if (!limits.allowPrivate) return forbidden(`Private files require a Pro plan or higher (current: ${limits.planName})`)
  }

  const burnAfterRead = form.get('burnAfterRead') === 'true'
  const password = form.get('password')
  if (burnAfterRead && !limits.allowBurnAfterRead) {
    return forbidden(`Burn-after-read requires a higher plan (current: ${limits.planName})`)
  }
  if (password && !limits.allowPassword) {
    return forbidden(`Password protection requires a higher plan (current: ${limits.planName})`)
  }
  if (burnAfterRead && password) {
    return badRequest('Burn-after-read cannot combine with password protection')
  }

  const expiryPreset = String(form.get('expiryPreset') || 'never')
  const expiryCustom = form.get('expiryCustom') ? String(form.get('expiryCustom')) : undefined
  if (!isExpiryAllowed(expiryPreset, limits)) {
    if (expiryPreset === 'custom') {
      return forbidden(`Custom expiry requires a Pro plan or higher (current: ${limits.planName})`)
    }
    return forbidden(`Expiry "${expiryPreset}" is not available on your plan (current: ${limits.planName})`)
  }
  const expiresAt = computeExpiry(expiryPreset, expiryCustom)
  if (expiryPreset === 'custom' && !expiresAt) return badRequest('Invalid custom expiry')
  if (expiresAt && expiresAt.getTime() < Date.now()) return badRequest('Expiry in the past')

  const buf = Buffer.from(await file.arrayBuffer())
  const storageKey = buildStorageKey(file.name)
  const storage = getStorage()
  await storage.upload(storageKey, buf, file.type || 'application/octet-stream')

  const slug = await generateUniqueSlug()
  const passwordHash = password ? await hashPassword(String(password)) : null

  const paste = await db.paste.create({
    data: {
      ownerId: session?.userId ?? null,
      title: (form.get('title') as string | null)?.trim().slice(0, 255) || null,
      description: (form.get('description') as string | null)?.trim().slice(0, 1000) || null,
      tags: (form.get('tags') as string | null)?.trim().slice(0, 500) || null,
      slug,
      contentType: 'file',
      language: 'plaintext',
      storageDriver: 'local',
      storageKey,
      originalFileName: file.name.slice(0, 255),
      mimeType: (file.type || 'application/octet-stream').slice(0, 100),
      fileSizeBytes: file.size,
      visibility,
      passwordHash,
      burnAfterRead,
      expiresAt,
    },
    include: { owner: true },
  })

  if (session) {
    await incrementMonthlyPastes(session.userId)
    invalidateUserPastes(session.userId)
  }
  return created('File uploaded successfully', [toSafePaste(paste, { includeContent: false })])
}

// GET /api/file?id=slug — download file bytes (raw stream)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const meta = searchParams.get('meta')
  if (!id) return badRequest('id is required')

  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return notFound('File not found')
  if (paste.contentType !== 'file') return badRequest('Not a file paste')

  if (paste.visibility === 'private') {
    if (!session) return unauthorized('Login required')
    if (paste.ownerId !== session.userId && session.role !== 'admin') {
      const grant = paste.ownerId
        ? await db.pasteAccessGrant.findUnique({
            where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
          })
        : null
      if (!grant) return forbidden('No access')
    }
  }
  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('File is gone')

  const unlockedHeader = req.headers.get('x-unlocked') || ''
  const unlocked = new Set(unlockedHeader.split(',').filter(Boolean))
  if (
    paste.passwordHash &&
    !unlocked.has(paste.id) &&
    !(session && (session.userId === paste.ownerId || session.role === 'admin'))
  ) {
    if (meta) {
      return ok('Password required', [{ ...toSafePaste(paste), passwordRequired: true }])
    }
    return forbidden('Password required')
  }

  // metadata-only response
  if (meta) {
    return ok('File metadata', [toSafePaste(paste)])
  }

  // actual download
  const storage = getStorage()
  const buf = await storage.download(paste.storageKey!)

  // burn-after-read
  if (paste.burnAfterRead && !paste.isBurned) {
    await db.paste.update({
      where: { id: paste.id },
      data: { isBurned: true, viewCount: { increment: 1 } },
    })
    invalidatePaste(paste.slug)
    invalidatePaste(paste.id)
    // also delete the storage object
    await storage.delete(paste.storageKey!)
  } else {
    await db.paste.update({ where: { id: paste.id }, data: { viewCount: { increment: 1 } } })
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': paste.mimeType || 'application/octet-stream',
      'Content-Length': String(buf.length),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(paste.originalFileName || paste.slug)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// DELETE /api/file?id=slug — delete own file
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const { searchParams } = new URL(req.url)
  let body: { id?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* allow empty */
  }
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }], isDeleted: false },
  })
  if (!paste) return notFound('File not found')
  if (paste.contentType !== 'file') return badRequest('Not a file paste')
  if (paste.ownerId !== session.userId && session.role !== 'admin') {
    return forbidden('Not the owner')
  }

  await db.paste.update({ where: { id: paste.id }, data: { isDeleted: true } })
  invalidatePaste(paste.slug)
  invalidatePaste(paste.id)
  if (paste.ownerId) invalidateUserPastes(paste.ownerId)
  // also delete storage object
  if (paste.storageKey) {
    await getStorage().delete(paste.storageKey)
  }
  return ok('File deleted', [])
}
