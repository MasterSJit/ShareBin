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
import { getSession, hashPassword, comparePassword } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import {
  generateUniqueSlug,
  computeExpiry,
  isExpired,
  VISIBILITY,
  auditLog,
  getSetting,
} from '@/lib/paste-utils'
import { toSafePaste, findPaste, invalidatePaste, invalidateUserPastes, recordView } from '@/lib/paste-access'
import { getUserLimits, isExpiryAllowed, checkMonthlyLimit, checkStorageLimit, incrementMonthlyPastes } from '@/lib/rbac'
import { runCleanup, hardDeletePaste } from '@/lib/cleanup'

// PUT /api/paste — create a text paste
export async function PUT(req: NextRequest) {
  const session = await getSession()

  let body: {
    title?: string
    description?: string
    tags?: string
    language?: string
    textContent?: string
    visibility?: string
    password?: string
    burnAfterRead?: boolean
    expiryPreset?: string
    expiryCustom?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Guest-post gating
  const guestOk = await getSetting<boolean>('guestPostingEnabled')
  if (!guestOk && !session) {
    return forbidden('Guest posting is disabled. Please log in.')
  }

  // ---- Plan limits ----
  const limits = await getUserLimits(session?.userId ?? null)

  // Private requires login + plan
  if (body.visibility === 'private') {
    if (!session) return forbidden('Private pastes require login')
    if (!limits.allowPrivate) return forbidden(`Private pastes require a Pro plan or higher (current: ${limits.planName})`)
  }

  // Burn-after-read requires plan
  if (body.burnAfterRead && !limits.allowBurnAfterRead) {
    return forbidden(`Burn-after-read requires a higher plan (current: ${limits.planName})`)
  }

  // Password protection requires plan
  if (body.password && !limits.allowPassword) {
    return forbidden(`Password protection requires a higher plan (current: ${limits.planName})`)
  }

  // Burn-after-read cannot be combined with password protection
  if (body.burnAfterRead && body.password) {
    return unprocessable('Burn-after-read cannot be combined with password protection')
  }

  // Expiry preset must be allowed by plan
  const expiryPreset = body.expiryPreset || 'never'
  if (!isExpiryAllowed(expiryPreset, limits)) {
    if (expiryPreset === 'custom') {
      return forbidden(`Custom expiry requires a Pro plan or higher (current: ${limits.planName})`)
    }
    return forbidden(`Expiry "${expiryPreset}" is not available on your plan (current: ${limits.planName})`)
  }

  if (!body.textContent || !body.textContent.trim()) {
    return badRequest('textContent is required')
  }

  // Per-paste size limit (text content size in bytes)
  const textBytes = Buffer.byteLength(body.textContent, 'utf8')
  if (textBytes > limits.maxPasteSize) {
    return forbidden(`Paste too large (max ${limits.maxPasteSize} bytes on ${limits.planName} plan)`)
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (rateLimitHit(`paste:${ip}`, 30, 60_000)) {
    return tooManyRequests('Too many pastes created. Slow down.')
  }

  // Monthly paste limit
  const canCreate = await checkMonthlyLimit(session?.userId ?? null, limits)
  if (!canCreate) {
    return tooManyRequests(`Monthly paste limit reached (${limits.maxPastesPerMonth} on ${limits.planName} plan)`)
  }

  const visibility = (VISIBILITY as readonly string[]).includes(body.visibility || '')
    ? (body.visibility as string)
    : 'public'

  const slug = await generateUniqueSlug()
  const expiresAt = computeExpiry(expiryPreset, body.expiryCustom)
  if (expiryPreset === 'custom' && !expiresAt) {
    return unprocessable('Invalid custom expiry date')
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return unprocessable('Expiry date is in the past')
  }

  const passwordHash = body.password ? await hashPassword(body.password) : null

  const paste = await db.paste.create({
    data: {
      ownerId: session?.userId ?? null,
      title: body.title?.trim().slice(0, 255) || null,
      description: body.description?.trim().slice(0, 1000) || null,
      tags: body.tags?.trim().slice(0, 500) || null,
      slug,
      contentType: 'text',
      language: (body.language || 'plaintext').slice(0, 50),
      textContent: body.textContent.slice(0, limits.maxPasteSize),
      visibility,
      passwordHash,
      burnAfterRead: !!body.burnAfterRead,
      isBurned: false,
      expiresAt,
    },
    include: { owner: true },
  })

  if (session) {
    await incrementMonthlyPastes(session.userId)
    invalidateUserPastes(session.userId)
  }
  return created('Paste created successfully', [toSafePaste(paste, { includeContent: false })])
}

// PATCH /api/paste — update own paste (id in body/query/path)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: {
    id?: string
    title?: string
    description?: string
    tags?: string
    language?: string
    textContent?: string
    visibility?: string
    password?: string | null
    burnAfterRead?: boolean
    expiryPreset?: string
    expiryCustom?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await findPaste(id)
  if (!paste) return notFound('Paste not found')
  if (paste.ownerId !== session.userId && session.role !== 'admin') {
    return forbidden('Not the owner')
  }
  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('Paste is gone')

  const patch: Record<string, unknown> = {}
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 255) || null
  if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 1000) || null
  if (typeof body.tags === 'string') patch.tags = body.tags.trim().slice(0, 500) || null
  if (typeof body.language === 'string') patch.language = body.language.slice(0, 50)
  if (typeof body.textContent === 'string') patch.textContent = body.textContent.slice(0, 5 * 1024 * 1024)
  if (typeof body.visibility === 'string' && (VISIBILITY as readonly string[]).includes(body.visibility)) {
    if (body.visibility === 'private' && !paste.ownerId) {
      return forbidden('Cannot make a guest paste private')
    }
    patch.visibility = body.visibility
  }
  if (typeof body.burnAfterRead === 'boolean') patch.burnAfterRead = body.burnAfterRead
  if (body.expiryPreset) {
    const exp = computeExpiry(body.expiryPreset, body.expiryCustom)
    if (body.expiryPreset === 'custom' && !exp) return unprocessable('Invalid custom expiry')
    if (exp && exp.getTime() < Date.now()) return unprocessable('Expiry in the past')
    patch.expiresAt = exp
  }
  if (body.password !== undefined) {
    if (body.password === null || body.password === '') {
      patch.passwordHash = null
    } else {
      if (paste.burnAfterRead) return unprocessable('Cannot combine password with burn-after-read')
      patch.passwordHash = await hashPassword(body.password)
    }
  }

  const updated = await db.paste.update({
    where: { id: paste.id },
    data: patch,
    include: { owner: true },
  })
  invalidatePaste(paste.slug)
  invalidatePaste(paste.id)
  if (paste.ownerId) invalidateUserPastes(paste.ownerId)
  return ok('Paste updated', [toSafePaste(updated, { includeContent: false })])
}

// DELETE /api/paste — soft-delete own paste
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: { id?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* allow empty */
  }
  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }], isDeleted: false },
  })
  if (!paste) return notFound('Paste not found')
  if (paste.ownerId !== session.userId && session.role !== 'admin') {
    return forbidden('Not the owner')
  }

  // Hard-delete the paste (storage file + record + grants)
  await hardDeletePaste(paste.id, 'admin', session.userId)
  return ok('Paste permanently deleted', [])
}

// GET /api/paste — list (public/own) or get by id/slug
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const scope = searchParams.get('scope') || 'public' // public | own | trending | language
  const language = searchParams.get('language')
  const q = searchParams.get('q')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

  const session = await getSession()

  // Opportunistically run cleanup (expires old + burned pastes). Fire-and-forget.
  runCleanup().catch(() => {})

  // Single paste fetch
  if (id) {
    const paste = await findPaste(id)
    if (!paste) return notFound('Paste not found')

    // If expired, hard-delete it now and return 410
    if (isExpired(paste.expiresAt)) {
      await hardDeletePaste(paste.id, 'expired')
      return gone('Paste has expired and been permanently deleted')
    }

    // If already burned, hard-delete it now and return 410
    if (paste.isBurned) {
      await hardDeletePaste(paste.id, 'burned')
      return gone('Paste was burned after reading and has been permanently deleted')
    }

    // Access control
    if (paste.visibility === 'private') {
      if (!session) return unauthorized('Login required to view this private paste')
      if (paste.ownerId !== session.userId && session.role !== 'admin') {
        // check access grant
        if (paste.ownerId) {
          const grant = await db.pasteAccessGrant.findUnique({
            where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
          })
          if (!grant) return forbidden('You do not have access to this private paste')
        } else {
          return forbidden('You do not have access to this private paste')
        }
      }
    }

    // Password gate
    const unlockedHeader = req.headers.get('x-unlocked') || ''
    const unlocked = new Set(unlockedHeader.split(',').filter(Boolean))
    const needsPassword = !!paste.passwordHash && !unlocked.has(paste.id) && !(session && (session.userId === paste.ownerId || session.role === 'admin'))

    if (needsPassword) {
      return ok('Password required', [
        { ...toSafePaste(paste, { includeContent: false }), passwordRequired: true },
      ])
    }

    recordView(paste.id)

    // Burn-after-read: return content, increment views, then hard-delete the paste.
    // The user gets the content in this response; the paste is permanently gone after.
    if (paste.burnAfterRead && !paste.isBurned) {
      // Increment view count first
      await db.paste.update({
        where: { id: paste.id },
        data: { isBurned: true, viewCount: { increment: 1 } },
      })
      invalidatePaste(paste.slug)
      invalidatePaste(paste.id)
      // Return the content to the user
      const safePaste = toSafePaste(paste, { includeContent: true })
      // Hard-delete after returning content (fire-and-forget with a small delay)
      setTimeout(async () => {
        try {
          await hardDeletePaste(paste.id, 'burned')
        } catch { /* ignore */ }
      }, 100)
      return ok('Paste fetched (burned after read)', [{ ...safePaste, isBurned: true }])
    }

    // Non-burn: increment view counter immediately
    await db.paste.update({ where: { id: paste.id }, data: { viewCount: { increment: 1 } } })

    return ok('Paste fetched', [toSafePaste(paste, { includeContent: true })])
  }

  // Listing
  const where: Record<string, unknown> = { isDeleted: false }

  if (scope === 'own') {
    if (!session) return unauthorized('Authentication required')
    where.ownerId = session.userId
  } else if (scope === 'language' && language) {
    where.visibility = 'public'
    where.language = language
    where.expiresAt = null // don't show expired in language browse (SQLite OR handling below)
  } else if (scope === 'trending') {
    where.visibility = 'public'
  } else {
    where.visibility = 'public'
  }

  // Hide expired from listings (best-effort — SQLite doesn't have a clean OR-null here without raw SQL;
  // we filter in JS to be safe)
  const orderBy =
    scope === 'trending'
      ? { viewCount: 'desc' as const }
      : { createdAt: 'desc' as const }

  let rows = await db.paste.findMany({
    where,
    include: { owner: true },
    orderBy,
    take: pageSize * 2, // over-fetch to allow in-JS expired filter
  })

  // filter expired + (optional) search
  rows = rows.filter((p) => !isExpired(p.expiresAt))
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(ql) ||
        (p.description || '').toLowerCase().includes(ql) ||
        (p.textContent || '').toLowerCase().includes(ql) ||
        (p.tags || '').toLowerCase().includes(ql) ||
        (p.language || '').toLowerCase().includes(ql)
    )
  }
  rows = rows.slice((page - 1) * pageSize, page * pageSize)

  return ok('Pastes fetched', rows.map((p) => toSafePaste(p, { includeContent: false })))
}
