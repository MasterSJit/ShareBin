import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest } from '@/lib/api-response'

// ============================================================
// Public Ads API — /api/ads
// Returns active ads for a given slot. No auth required.
// ============================================================

type PublicAd = {
  id: string
  name: string
  slot: string
  adType: string
  content: string
  imageUrl: string | null
  linkUrl: string | null
}

// GET /api/ads?slot=sidebar — public, returns active ads for the slot
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slot = searchParams.get('slot')
  if (!slot) return badRequest('slot is required')

  const now = new Date()
  const ads = await db.ad.findMany({
    where: {
      slot,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  // Best-effort: increment impressions for each returned ad
  const ids = ads.map((a) => a.id)
  if (ids.length > 0) {
    try {
      await db.ad.updateMany({
        where: { id: { in: ids } },
        data: { impressions: { increment: 1 } },
      })
    } catch {
      // best-effort — do not fail the request
    }
  }

  const out: PublicAd[] = ads.map((a) => ({
    id: a.id,
    name: a.name,
    slot: a.slot,
    adType: a.adType,
    content: a.content,
    imageUrl: a.imageUrl,
    linkUrl: a.linkUrl,
  }))
  return ok('Ads fetched', out)
}
