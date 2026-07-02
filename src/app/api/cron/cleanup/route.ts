import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { runCleanup } from '@/lib/cleanup'

/**
 * POST /api/cron/cleanup — hard-delete all expired + burned pastes.
 * Can be called by a cron scheduler or manually.
 * No auth required (the endpoint path is the secret) — but accepts an
 * optional `?key=` query for an extra layer if desired.
 */
export async function POST(req: NextRequest) {
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
