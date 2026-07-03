import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, notFound } from '@/lib/api-response'
import { parseJsonBody } from '@/lib/parse-body'

// ============================================================
// Public Ads click tracking — /api/ads/click
// POST { id } — increments `clicks` by 1 for the ad
// ============================================================

// POST /api/ads/click — record a click on an ad (no auth)
export async function POST(req: NextRequest) {
  const { data: body, error: je } = await parseJsonBody<{ id?: string }>(req)
  if (je || !body) return badRequest(je || 'Invalid JSON')
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required')

  const ad = await db.ad.findUnique({ where: { id: body.id }, select: { id: true } })
  if (!ad) return notFound('Ad not found')

  await db.ad.update({
    where: { id: body.id },
    data: { clicks: { increment: 1 } },
  })

  return ok('Click recorded', [])
}
