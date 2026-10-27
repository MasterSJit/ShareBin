import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
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
import { computeExpiry, isExpired, VISIBILITY, getSetting, generateUniqueSlug } from '@/lib/paste-utils'
import { toSafePaste, findPaste, invalidatePasteRecord, canModerate } from '@/lib/paste-access'
import { readPaste } from '@/lib/paste-read'
import {
  getUserLimits,
  isExpiryAllowed,
  checkMonthlyLimit,
  incrementMonthlyPastes,
  recomputeUsage,
} from '@/lib/rbac'
import { maybeRunCleanup, hardDeletePaste } from '@/lib/cleanup'
import { scanTextContent } from '@/lib/security-scan'
import { validateCreateOptions, getScanSettings, siteBaseUrl, pasteLinks } from '@/lib/paste-create'

type CreateBody = {
  title?: string
  description?: string
  tags?: string | string[]
  language?: string
  textContent?: string
  visibility?: string
  password?: string
  burnAfterRead?: boolean | string
  expiryPreset?: string
  expiryCustom?: string
}

function normaliseTags(tags: unknown): string | null {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : []
  const cleaned = [
    ...new Set(
      list
        .map((t) => String(t).trim().replace(/^#/, '').slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20)
  return cleaned.length ? cleaned.join(',') : null
}

/**
 * Read the create body. JSON is the main format; `text/plain` (or any non-JSON
 * body) is accepted for CLI use — options then come from the query string:
 *   curl --data-binary @file.py "https://host/api/paste?language=python&expiryPreset=1d"
 */
async function readCreateBody(req: NextRequest): Promise<CreateBody | null> {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    try {
      return (await req.json()) as CreateBody
    } catch {
      return null
    }
  }
  const text = await req.text()
  const q = new URL(req.url).searchParams
  return {
    textContent: text,
    title: q.get('title') ?? undefined,
    description: q.get('description') ?? undefined,
    tags: q.get('tags') ?? undefined,
    language: q.get('language') ?? undefined,
    visibility: q.get('visibility') ?? undefined,
    password: q.get('password') ?? undefined,
    burnAfterRead: q.get('burnAfterRead') ?? undefined,
    expiryPreset: q.get('expiryPreset') ?? q.get('expiry') ?? undefined,
    expiryCustom: q.get('expiryCustom') ?? undefined,
  }
}

// PUT /api/paste — create a text paste (POST is an alias for CLI tools)
export async function PUT(req: NextRequest) {
  const session = await getSession()

  const body = await readCreateBody(req)
  if (!body) return badRequest('Invalid JSON body')

  // Guest-post gating
  const guestOk = await getSetting<boolean>('guestPostingEnabled')
  if (guestOk === false && !session) {
    return forbidden('Guest posting is disabled. Please log in.')
  }

  const textContent = typeof body.textContent === 'string' ? body.textContent : ''
  if (!textContent.trim()) return badRequest('textContent is required')

  // ---- Plan limits ----
  const limits = await getUserLimits(session?.userId ?? null)
  const validated = await validateCreateOptions(
    {
      visibility: body.visibility,
      password: body.password,
      burnAfterRead: body.burnAfterRead === true || body.burnAfterRead === 'true' || body.burnAfterRead === '1',
      expiryPreset: body.expiryPreset,
      expiryCustom: body.expiryCustom,
    },
    session,
    limits,
  )
  if (!validated.ok) return validated.response
  const opts = validated.options

  // Per-paste size limit (text content size in bytes)
  const textBytes = Buffer.byteLength(textContent, 'utf8')
  if (textBytes > limits.maxPasteSize) {
    return forbidden(`Paste too large (${textBytes} bytes, max ${limits.maxPasteSize} on ${limits.planName} plan)`)
  }

  // ---- Spam / malware scan ----
  const scanCfg = await getScanSettings()
  if (scanCfg.enabled) {
    const scan = scanTextContent(
      [body.title, body.description, textContent].filter(Boolean).join('\n'),
      { bannedWords: scanCfg.bannedWords, strict: scanCfg.strict },
    )
    if (!scan.safe) {
      return unprocessable('Content rejected by spam/malware scanner', [{ threats: scan.threats }])
    }
  }

  const rateKey = session ? `paste:u:${session.userId}` : `paste:ip:${clientIp(req.headers)}`
  if (rateLimitHit(rateKey, 30, 60_000)) {
    return tooManyRequests('Too many pastes created. Slow down.')
  }

  // Monthly paste limit
  const canCreate = await checkMonthlyLimit(session?.userId ?? null, limits)
  if (!canCreate) {
    return tooManyRequests(`Monthly paste limit reached (${limits.maxPastesPerMonth} on ${limits.planName} plan)`)
  }

  const passwordHash = opts.password ? await hashPassword(opts.password) : null

  const paste = await db.paste.create({
    data: {
      ownerId: session?.userId ?? null,
      title: body.title?.trim().slice(0, 255) || null,
      description: body.description?.trim().slice(0, 1000) || null,
      tags: normaliseTags(body.tags),
      slug: await generateUniqueSlug(),
      contentType: 'text',
      language: (body.language || 'plaintext').trim().slice(0, 50) || 'plaintext',
      textContent,
      visibility: opts.visibility,
      passwordHash,
      burnAfterRead: opts.burnAfterRead,
      isBurned: false,
      expiresAt: opts.expiresAt,
    },
    include: { owner: true },
  })

  if (session) {
    await incrementMonthlyPastes(session.userId)
    await recomputeUsage(session.userId).catch(() => {})
    invalidatePasteRecord(paste)
  }

  const links = pasteLinks(await siteBaseUrl(req), paste)
  // `?format=url` → just the link as text/plain (handy for `curl | pbcopy`)
  if (new URL(req.url).searchParams.get('format') === 'url') {
    return new Response(links.url + '\n', {
      status: 201,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return created('Paste created successfully', [
    { ...toSafePaste(paste, { includeContent: false }), ...links },
  ])
}

export const POST = PUT

// PATCH /api/paste — update own paste (id in body/query/path)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: {
    id?: string
    title?: string | null
    description?: string | null
    tags?: string | string[] | null
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
  const isOwner = paste.ownerId === session.userId
  if (!isOwner && !(await canModerate(session))) {
    return forbidden('Not the owner')
  }
  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('Paste is gone')

  // Owners are bound by their plan; moderators editing someone else's paste
  // are checked against the owner's plan so they can't grant extra features.
  const limits = await getUserLimits(paste.ownerId)
  const patch: Prisma.PasteUpdateInput = {}

  if (body.title !== undefined) patch.title = body.title?.trim().slice(0, 255) || null
  if (body.description !== undefined) patch.description = body.description?.trim().slice(0, 1000) || null
  if (body.tags !== undefined) patch.tags = normaliseTags(body.tags)
  if (typeof body.language === 'string') patch.language = body.language.trim().slice(0, 50) || 'plaintext'

  if (typeof body.textContent === 'string') {
    if (paste.contentType !== 'text') return badRequest('File pastes have no text content to edit')
    if (!body.textContent.trim()) return badRequest('textContent cannot be empty')
    const bytes = Buffer.byteLength(body.textContent, 'utf8')
    if (bytes > limits.maxPasteSize) {
      return forbidden(`Paste too large (max ${limits.maxPasteSize} bytes on ${limits.planName} plan)`)
    }
    const scanCfg = await getScanSettings()
    if (scanCfg.enabled) {
      const scan = scanTextContent(body.textContent, { bannedWords: scanCfg.bannedWords, strict: scanCfg.strict })
      if (!scan.safe) return unprocessable('Content rejected by spam/malware scanner', [{ threats: scan.threats }])
    }
    patch.textContent = body.textContent
  }

  if (typeof body.visibility === 'string' && (VISIBILITY as readonly string[]).includes(body.visibility)) {
    if (body.visibility === 'private') {
      if (!paste.ownerId) return forbidden('Cannot make a guest paste private')
      if (!limits.allowPrivate && paste.visibility !== 'private') {
        return forbidden(`Private pastes require a Pro plan or higher (current: ${limits.planName})`)
      }
    }
    patch.visibility = body.visibility
  }

  const nextHasPassword =
    body.password === undefined ? !!paste.passwordHash : !!body.password
  const nextBurn = typeof body.burnAfterRead === 'boolean' ? body.burnAfterRead : paste.burnAfterRead
  if (nextBurn && nextHasPassword) {
    return unprocessable('Burn-after-read cannot be combined with password protection')
  }

  if (typeof body.burnAfterRead === 'boolean') {
    if (body.burnAfterRead && !limits.allowBurnAfterRead) {
      return forbidden(`Burn-after-read requires a higher plan (current: ${limits.planName})`)
    }
    patch.burnAfterRead = body.burnAfterRead
  }
  if (body.expiryPreset) {
    if (!isExpiryAllowed(body.expiryPreset, limits)) {
      return forbidden(`Expiry "${body.expiryPreset}" is not available on the ${limits.planName} plan`)
    }
    const exp = computeExpiry(body.expiryPreset, body.expiryCustom)
    if (body.expiryPreset === 'custom' && !exp) return unprocessable('Invalid custom expiry')
    if (exp && exp.getTime() < Date.now()) return unprocessable('Expiry in the past')
    patch.expiresAt = exp
  }
  if (body.password !== undefined) {
    if (body.password === null || body.password === '') {
      patch.passwordHash = null
    } else {
      if (!limits.allowPassword) {
        return forbidden(`Password protection requires a higher plan (current: ${limits.planName})`)
      }
      if (body.password.length > 256) return unprocessable('Password is too long (max 256 characters)')
      patch.passwordHash = await hashPassword(body.password)
    }
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')

  const updated = await db.paste.update({
    where: { id: paste.id },
    data: patch,
    include: { owner: true },
  })
  invalidatePasteRecord(paste)
  return ok('Paste updated', [toSafePaste(updated, { includeContent: true })])
}

// DELETE /api/paste — permanently delete own paste
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: { id?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* allow empty */
  }
  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  })
  if (!paste) return notFound('Paste not found')
  const isOwner = paste.ownerId === session.userId
  if (!isOwner && !(await canModerate(session))) {
    return forbidden('Not the owner')
  }

  // Hard-delete the paste (storage file + record + grants)
  await hardDeletePaste(paste.id, isOwner ? 'owner' : 'admin', session.userId)
  return ok('Paste permanently deleted', [])
}

// GET /api/paste — list (public/own/trending/language) or get by id/slug
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  // Opportunistically clean up expired + burned pastes (throttled).
  maybeRunCleanup()

  if (id) return readPaste(req, id)

  const scope = searchParams.get('scope') || 'public' // public | own | trending | language
  const language = searchParams.get('language')
  const q = searchParams.get('q')?.trim()
  const type = searchParams.get('type') // text | file
  const tag = searchParams.get('tag')?.trim().toLowerCase()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20))

  const session = await getSession()
  const now = new Date()

  const and: Prisma.PasteWhereInput[] = [{ isDeleted: false }]

  if (scope === 'own') {
    if (!session) return unauthorized('Authentication required')
    and.push({ ownerId: session.userId })
  } else {
    // Public listings never show expired or already-burned pastes.
    and.push({ visibility: 'public', isBurned: false })
    and.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] })
    if (scope === 'language' && language) and.push({ language })
    if (scope === 'trending') {
      and.push({ createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    }
  }
  if (type === 'text' || type === 'file') and.push({ contentType: type })
  if (tag) and.push({ tags: { contains: tag } })
  if (q) {
    const textMatch: Prisma.PasteWhereInput[] = [
      { title: { contains: q } },
      { description: { contains: q } },
      { tags: { contains: q } },
      { language: { contains: q } },
      { originalFileName: { contains: q } },
      { slug: q },
    ]
    // Never search the body of locked pastes — that would leak their content
    // through a search oracle. (Owners searching their own pastes may.)
    textMatch.push(
      scope === 'own'
        ? { textContent: { contains: q } }
        : { AND: [{ passwordHash: null }, { burnAfterRead: false }, { textContent: { contains: q } }] },
    )
    and.push({ OR: textMatch })
  }

  const orderBy: Prisma.PasteOrderByWithRelationInput[] =
    scope === 'trending' ? [{ viewCount: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }]

  const where: Prisma.PasteWhereInput = { AND: and }
  const [rows, total] = await Promise.all([
    db.paste.findMany({
      where,
      include: { owner: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.paste.count({ where }),
  ])

  const res = ok(
    'Pastes fetched',
    rows.map((p) => toSafePaste(p, { includeContent: false, includePreview: true })),
  )
  res.headers.set('X-Total-Count', String(total))
  res.headers.set('X-Page', String(page))
  res.headers.set('X-Page-Size', String(pageSize))
  return res
}
