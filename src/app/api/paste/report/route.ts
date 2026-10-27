import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, notFound, tooManyRequests } from '@/lib/api-response'
import { getSession, clientIp } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import { auditLog } from '@/lib/paste-utils'
import { findPaste, invalidatePasteRecord } from '@/lib/paste-access'

const REASONS = ['spam', 'malware', 'phishing', 'illegal', 'personal_info', 'copyright', 'other'] as const

/**
 * POST /api/paste/report — report abusive content (no login needed).
 * Body: { id, reason, details? }
 * Flags the paste for moderators (Admin → Content → Flagged) and records the
 * report in the audit log. Content stays up until a moderator acts.
 */
export async function POST(req: NextRequest) {
  let body: { id?: string; reason?: string; details?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  if (!body.id) return badRequest('id is required')
  const reason = (REASONS as readonly string[]).includes(body.reason || '') ? body.reason! : 'other'

  const ip = clientIp(req.headers)
  if (rateLimitHit(`report:${ip}`, 5, 10 * 60_000)) {
    return tooManyRequests('Too many reports. Try again later.')
  }

  const paste = await findPaste(body.id)
  if (!paste) return notFound('Paste not found')

  const session = await getSession()
  if (!paste.isFlagged) {
    await db.paste.update({ where: { id: paste.id }, data: { isFlagged: true } })
    invalidatePasteRecord(paste)
  }
  await auditLog(session?.userId ?? null, 'report_paste', 'paste', paste.id, {
    slug: paste.slug,
    reason,
    details: body.details?.slice(0, 1000) || null,
    reporter: session ? session.email : 'guest',
  })
  return ok('Thanks — the paste was reported to the moderators', [{ id: paste.id, reason }])
}
