import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, badRequest, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { parseJsonBody } from '@/lib/parse-body'
import { auditLog } from '@/lib/paste-utils'

// ============================================================
// Admin Ads CRUD — /api/admin/ad
// ============================================================

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

type AdRow = {
  id: string
  name: string
  slot: string
  adType: string
  content: string
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
  impressions: number
  clicks: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

function adToSafe(a: {
  id: string
  name: string
  slot: string
  adType: string
  content: string
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
  impressions: number
  clicks: number
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
}): AdRow {
  return {
    id: a.id,
    name: a.name,
    slot: a.slot,
    adType: a.adType,
    content: a.content,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
    isActive: a.isActive,
    impressions: a.impressions,
    clicks: a.clicks,
    startsAt: a.startsAt ? a.startsAt.toISOString() : null,
    endsAt: a.endsAt ? a.endsAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  }
}

const VALID_SLOTS = ['header', 'sidebar', 'footer', 'between-cards', 'paste-top', 'paste-bottom']
const VALID_TYPES = ['html', 'image', 'adsense', 'custom']

function parseDate(v: unknown): Date | null | undefined {
  // undefined → field not provided (caller treats as "no change" / "default")
  // null or '' → explicit null
  // string → parse; invalid → symbol for "invalid"
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') return INVALID_DATE
  const d = new Date(v)
  if (isNaN(d.getTime())) return INVALID_DATE
  return d
}

const INVALID_DATE = '__invalid_date__' as unknown as Date

// GET /api/admin/ad — list all ads (admin only)
export async function GET(_req: NextRequest) {
  const { error, session } = await requirePerm('admin:content')
  if (error || !session) return error

  const ads = await db.ad.findMany({ orderBy: { createdAt: 'desc' } })
  return ok('Ads fetched', ads.map(adToSafe))
}

// PUT /api/admin/ad — create a new ad
export async function PUT(req: NextRequest) {
  const { error, session } = await requirePerm('admin:content')
  if (error || !session) return error

  const { data: body, error: je1 } = await parseJsonBody<{
    name?: string
    slot?: string
    adType?: string
    content?: string
    imageUrl?: string
    linkUrl?: string
    isActive?: boolean
    startsAt?: string | null
    endsAt?: string | null
  }>(req)
  if (je1 || !body) return badRequest(je1 || 'Invalid JSON')
  if (!body.name || typeof body.name !== 'string') return badRequest('name is required')
  if (!body.content || typeof body.content !== 'string') return badRequest('content is required')

  const slot = body.slot && VALID_SLOTS.includes(body.slot) ? body.slot : 'sidebar'
  const adType = body.adType && VALID_TYPES.includes(body.adType) ? body.adType : 'html'

  const existing = await db.ad.findUnique({ where: { name: body.name } })
  if (existing) return badRequest('Ad name already exists')

  const startsAt = parseDate(body.startsAt)
  const endsAt = parseDate(body.endsAt)
  if (startsAt === INVALID_DATE) return badRequest('Invalid startsAt')
  if (endsAt === INVALID_DATE) return badRequest('Invalid endsAt')

  const ad = await db.ad.create({
    data: {
      name: body.name,
      slot,
      adType,
      content: body.content,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      linkUrl: body.linkUrl ? String(body.linkUrl) : null,
      isActive: body.isActive !== false,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
    },
  })
  await auditLog(session.userId, 'create_ad', 'ad', ad.id, { name: ad.name, slot: ad.slot })
  return created('Ad created', [adToSafe(ad)])
}

// PATCH /api/admin/ad — update an ad (id in body)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requirePerm('admin:content')
  if (error || !session) return error

  const { data: body, error: je2 } = await parseJsonBody<Record<string, unknown>>(req)
  if (je2 || !body) return badRequest(je2 || 'Invalid JSON')
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required')

  const ad = await db.ad.findUnique({ where: { id: body.id } })
  if (!ad) return notFound('Ad not found')

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name) {
    if (body.name !== ad.name) {
      const dup = await db.ad.findUnique({ where: { name: body.name } })
      if (dup) return badRequest('Ad name already exists')
    }
    patch.name = body.name
  }
  if (typeof body.slot === 'string' && VALID_SLOTS.includes(body.slot)) patch.slot = body.slot
  if (typeof body.adType === 'string' && VALID_TYPES.includes(body.adType)) patch.adType = body.adType
  if (typeof body.content === 'string') patch.content = body.content
  if (typeof body.imageUrl === 'string') patch.imageUrl = body.imageUrl || null
  if (typeof body.linkUrl === 'string') patch.linkUrl = body.linkUrl || null
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive

  if (body.startsAt !== undefined) {
    const d = parseDate(body.startsAt)
    if (d === INVALID_DATE) return badRequest('Invalid startsAt')
    patch.startsAt = d ?? null
  }
  if (body.endsAt !== undefined) {
    const d = parseDate(body.endsAt)
    if (d === INVALID_DATE) return badRequest('Invalid endsAt')
    patch.endsAt = d ?? null
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')
  const updated = await db.ad.update({ where: { id: body.id }, data: patch })
  await auditLog(session.userId, 'update_ad', 'ad', ad.id, { after: patch })
  return ok('Ad updated', [adToSafe(updated)])
}

// DELETE /api/admin/ad — delete an ad (id in body)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requirePerm('admin:content')
  if (error || !session) return error

  const { data: body, error: je3 } = await parseJsonBody<{ id?: string }>(req)
  if (je3 || !body) return badRequest(je3 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const ad = await db.ad.findUnique({ where: { id: body.id } })
  if (!ad) return notFound('Ad not found')

  await db.ad.delete({ where: { id: body.id } })
  await auditLog(session.userId, 'delete_ad', 'ad', body.id, { name: ad.name, slot: ad.slot })
  return ok('Ad deleted', [])
}
