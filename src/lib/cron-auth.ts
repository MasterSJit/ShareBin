import type { NextRequest } from 'next/server'
import { unauthorized } from '@/lib/api-response'
import { safeEqual } from '@/lib/auth'

/**
 * Guard for /api/cron/*. When CRON_SECRET is set, callers must present it as
 * `Authorization: Bearer <secret>`, `x-cron-secret: <secret>` or `?key=<secret>`.
 * Without CRON_SECRET the endpoints stay open (the jobs are idempotent and
 * only delete already-expired data) but a warning is logged in production.
 */
export function checkCronAuth(req: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[cron] CRON_SECRET is not set — /api/cron/* is callable by anyone')
    }
    return null
  }
  const auth = req.headers.get('authorization')
  const provided =
    (auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null) ||
    req.headers.get('x-cron-secret') ||
    new URL(req.url).searchParams.get('key') ||
    ''
  return provided && safeEqual(provided, secret) ? null : unauthorized('Invalid cron secret')
}
