import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, unauthorized, forbidden, tooManyRequests } from '@/lib/api-response'
import { setSessionCookie, comparePassword } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import type { SafeUser } from '@/lib/types'

function toSafeUser(u: {
  id: string
  email: string
  displayName: string | null
  role: string
  status: string
  emailVerifiedAt: Date | null
  apiKey: string | null
  createdAt: Date
}): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as 'user' | 'admin',
    status: u.status as SafeUser['status'],
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    apiKey: u.apiKey,
    createdAt: u.createdAt.toISOString(),
  }
}

// POST /api/auth/login — issue session cookie
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) return badRequest('email and password are required')

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (rateLimitHit(`login:${ip}`, 10, 60_000)) {
    return tooManyRequests('Too many login attempts. Try again in a minute.')
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) return unauthorized('Invalid credentials')

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) return unauthorized('Invalid credentials')

  if (user.status === 'banned') return forbidden('Account banned')
  if (user.status === 'suspended') return forbidden('Account suspended')

  await setSessionCookie({ userId: user.id, email: user.email, role: user.role })
  return ok('Login successful', [toSafeUser(user)])
}
