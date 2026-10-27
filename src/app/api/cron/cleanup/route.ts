import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { runCleanup } from '@/lib/cleanup'
import { checkCronAuth } from '@/lib/cron-auth'

/**
 * POST /api/cron/cleanup — hard-delete all expired + burned pastes and
 * expired password-reset tokens. Protected by CRON_SECRET when set.
 */
export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied
  try {
    const result = await runCleanup()
    return ok('Cleanup completed', [result])
  } catch (e) {
    return serverError('Cleanup failed: ' + (e as Error).message)
  }
}

// Also allow GET for simple cron triggers
export async function GET(req: NextRequest) {
  return POST(req)
}
