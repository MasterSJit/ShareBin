import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// ============================================================
// Admin Ads — single by id
// GET /api/admin/ad/[id]
// ============================================================

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

// GET /api/admin/ad/[id] — get a single ad by id
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requirePerm('admin:content')
  if (error || !session) return error

  const { id } = await ctx.params
  const ad = await db.ad.findUnique({ where: { id } })
  if (!ad) return notFound('Ad not found')

  return ok('Ad fetched', [
    {
      id: ad.id,
      name: ad.name,
      slot: ad.slot,
      adType: ad.adType,
      content: ad.content,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      isActive: ad.isActive,
      impressions: ad.impressions,
      clicks: ad.clicks,
      startsAt: ad.startsAt ? ad.startsAt.toISOString() : null,
      endsAt: ad.endsAt ? ad.endsAt.toISOString() : null,
      createdAt: ad.createdAt.toISOString(),
      updatedAt: ad.updatedAt.toISOString(),
    },
  ])
}
