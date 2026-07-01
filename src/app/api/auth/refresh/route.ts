import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized } from '@/lib/api-response'
import { getSession, setSessionCookie } from '@/lib/auth'
import type { SafeUser } from '@/lib/types'

// POST /api/auth/refresh — rotate session cookie (sliding expiry)
export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('No active session')
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return unauthorized('User no longer exists')
  if (user.status === 'banned' || user.status === 'suspended') {
    return unauthorized('Account is not active')
  }
  await setSessionCookie({ userId: user.id, email: user.email, role: user.role })
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
  return ok('Session refreshed', [safe])
}
