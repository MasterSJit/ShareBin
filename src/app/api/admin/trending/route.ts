import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { isExpired } from '@/lib/paste-utils'
import { toSafePaste } from '@/lib/paste-access'

// GET /api/admin/trending — top pastes by view count (admin trending widget)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  const { searchParams } = new URL(req.url)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
  const days = parseInt(searchParams.get('days') || '7', 10) // trending within last N days (0 = all time)

  const where: Record<string, unknown> = {
    isDeleted: false,
    visibility: 'public',
  }
  if (days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    where.createdAt = { gte: since }
  }

  const pastes = await db.paste.findMany({
    where,
    include: { owner: true },
    orderBy: { viewCount: 'desc' },
    take: limit * 2, // over-fetch to filter expired
  })

  const filtered = pastes
    .filter((p) => !isExpired(p.expiresAt))
    .slice(0, limit)
    .map((p) => toSafePaste(p, { includeContent: false }))

  return ok('Trending pastes', filtered)
}
