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

// PUT /api/file — multipart upload
export async function PUT(req: NextRequest) {
  const session = await getSession()

  const guestOk = await getSetting<boolean>('guestPostingEnabled')
  if (!guestOk && !session) return forbidden('Guest uploads are disabled. Please log in.')

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

  const maxSize = await getSetting<number>('maxFileSizeBytes')
  if (file.size > maxSize) {
    return badRequest(`File too large (max ${maxSize} bytes)`)
  }

  const visibility = (VISIBILITY as readonly string[]).includes(String(form.get('visibility') || ''))
    ? String(form.get('visibility'))
    : 'public'
  if (visibility === 'private' && !session) return forbidden('Private files require login')

  const burnAfterRead = form.get('burnAfterRead') === 'true'
  const password = form.get('password')
  if (burnAfterRead && password) {
    return badRequest('Burn-after-read cannot combine with password protection')
  }

  const expiryPreset = String(form.get('expiryPreset') || 'never')
  const expiryCustom = form.get('expiryCustom') ? String(form.get('expiryCustom')) : undefined
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

  if (session) invalidateUserPastes(session.userId)
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
