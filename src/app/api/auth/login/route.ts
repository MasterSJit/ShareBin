import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, unauthorized, forbidden, tooManyRequests } from '@/lib/api-response'
import { setSessionCookie, comparePassword, clientIp } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import { toSafeUser } from '@/lib/user-safe'

// Compared against when the email is unknown so response time doesn't reveal
// whether an account exists. (bcrypt hash of a random string, cost 12.)
const DUMMY_HASH = '$2b$12$knJ.fKZj.Q3gWJTbO.gV5ur1arEcFIGqid9r4VZ5AErnW2cUjve52'

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

  const ip = clientIp(req.headers)
  if (rateLimitHit(`login:${ip}`, 10, 60_000) || rateLimitHit(`login:acct:${email}`, 20, 15 * 60_000)) {
    return tooManyRequests('Too many login attempts. Try again in a minute.')
  }

  const user = await db.user.findUnique({ where: { email } })
  const valid = await comparePassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) return unauthorized('Invalid credentials')

  if (user.status === 'banned') return forbidden('Account banned')
  if (user.status === 'suspended') return forbidden('Account suspended')

  await setSessionCookie({ userId: user.id, email: user.email, role: user.role, v: user.sessionVersion })
  return ok('Login successful', [toSafeUser(user)])
}
