import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized } from '@/lib/api-response'
import { getSession, setSessionCookie } from '@/lib/auth'
import { toSafeUser } from '@/lib/user-safe'

// POST /api/auth/refresh — rotate session cookie (sliding expiry)
export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session || session.via !== 'session') return unauthorized('No active session')
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return unauthorized('User no longer exists')
  if (user.status === 'banned' || user.status === 'suspended') {
    return unauthorized('Account is not active')
  }
  await setSessionCookie({ userId: user.id, email: user.email, role: user.role, v: user.sessionVersion })
  return ok('Session refreshed', [toSafeUser(user)])
}
