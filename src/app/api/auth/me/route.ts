import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import type { SafeUser } from '@/lib/types'

// GET /api/auth/me — current user from session
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Not authenticated')
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return unauthorized('User no longer exists')
  const safe: SafeUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as 'user' | 'admin',
    status: user.status as SafeUser['status'],
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    apiKey: user.apiKey,
    createdAt: user.createdAt.toISOString(),
  }
  return ok('Current user', [safe])
}
