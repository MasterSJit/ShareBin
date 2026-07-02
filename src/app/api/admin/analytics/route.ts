import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { isExpired } from '@/lib/paste-utils'

// GET /api/admin/analytics — dashboard summary
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  const [totalUsers, totalPastes, totalFiles, flagged, burned] = await Promise.all([
    db.user.count(),
    db.paste.count({ where: { isDeleted: false, contentType: 'text' } }),
    db.paste.count({ where: { isDeleted: false, contentType: 'file' } }),
    db.paste.count({ where: { isDeleted: false, isFlagged: true } }),
    db.paste.count({ where: { isDeleted: false, isBurned: true } }),
  ])

  // Active (non-expired) pastes
  const allPastes = await db.paste.findMany({
    where: { isDeleted: false, contentType: 'text' },
    select: { expiresAt: true, language: true, viewCount: true, createdAt: true, fileSizeBytes: true, contentType: true, storageKey: true },
    take: 5000,
  })
  const activePastes = allPastes.filter((p) => !isExpired(p.expiresAt))
  const totalViews = activePastes.reduce((s, p) => s + (p.viewCount || 0), 0)

  // Top languages
  const langCounts = new Map<string, number>()
  for (const p of activePastes) {
    const l = p.language || 'plaintext'
    langCounts.set(l, (langCounts.get(l) ?? 0) + 1)
  }
  const topLanguages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([language, count]) => ({ language, count }))

  // Storage usage (file bytes)
  const files = await db.paste.findMany({
    where: { isDeleted: false, contentType: 'file' },
    select: { fileSizeBytes: true },
    take: 5000,
  })
  const storageUsedBytes = files.reduce((s, f) => s + (f.fileSizeBytes ?? 0), 0)

  // Traffic over time — last 14 days, paste-create counts by day
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recent = await db.paste.findMany({
    where: { createdAt: { gte: since }, isDeleted: false },
    select: { createdAt: true },
    take: 5000,
  })
  const byDay = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, 0)
  }
  for (const r of recent) {
    const key = r.createdAt.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  const traffic = [...byDay.entries()].map(([date, count]) => ({ date, count }))

  return ok('Analytics', [
    {
      totalUsers,
      totalPastes,
      totalFiles,
      totalActivePastes: activePastes.length,
      flaggedCount: flagged,
      burnedCount: burned,
      totalViews,
      storageUsedBytes,
      topLanguages,
      traffic,
    },
  ])
}
