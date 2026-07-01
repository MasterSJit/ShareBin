import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { isExpired } from '@/lib/paste-utils'

// GET /api/languages — list distinct languages used across public, non-expired pastes
export async function GET(_req: NextRequest) {
  const rows = await db.paste.findMany({
    where: { isDeleted: false, visibility: 'public', contentType: 'text' },
    select: { language: true, expiresAt: true },
    take: 5000,
  })
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (isExpired(r.expiresAt)) continue
    const l = r.language || 'plaintext'
    counts.set(l, (counts.get(l) ?? 0) + 1)
  }
  const languages = [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
  return ok('Languages fetched', languages)
}
