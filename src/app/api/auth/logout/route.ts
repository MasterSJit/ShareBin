import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { clearSessionCookie } from '@/lib/auth'

// POST /api/auth/logout — clear session cookie
export async function POST(_req: NextRequest) {
  await clearSessionCookie()
  return ok('Logged out', [])
}
