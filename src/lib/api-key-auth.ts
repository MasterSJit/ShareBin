import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession, type SessionPayload } from '@/lib/auth'

/**
 * Shape returned by both session- and API-key-based authentication.
 * `exp` is included for parity with SessionPayload (null for API-key users,
 * which never expire mid-request — they're validated per call).
 */
export type AuthenticatedUser = {
  userId: string
  email: string
  role: string
  /** 'session' = browser cookie, 'api_key' = x-api-key header. */
  authMethod: 'session' | 'api_key'
  /** Session expiry (ms epoch) when authed via session, else null. */
  exp: number | null
}

/**
 * Look up a user by the `x-api-key` header. Returns null if no header
 * is present, the key is unknown, or the user is not in an active state.
 */
export async function getApiKeyUser(
  req: NextRequest,
): Promise<AuthenticatedUser | null> {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null

  // Constant-ish length pre-check to avoid hitting the DB for junk.
  if (apiKey.length < 8 || apiKey.length > 128) return null

  const user = await db.user.findFirst({
    where: { apiKey },
    select: { id: true, email: true, role: true, status: true },
  })
  if (!user) return null
  if (user.status !== 'active') return null

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    authMethod: 'api_key',
    exp: null,
  }
}

/**
 * Resolve the current user from either the signed session cookie or the
 * `x-api-key` header. Session wins when both are present.
 *
 * External apps may use either mechanism:
 *   - Browser clients send their `ps_session` cookie automatically.
 *   - Bots/CLIs send `x-api-key: ps_<hex>` generated from the dashboard.
 */
export async function getAuthenticatedUser(
  req: NextRequest,
): Promise<AuthenticatedUser | null> {
  const session: SessionPayload | null = await getSession()
  if (session) {
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      authMethod: 'session',
      exp: session.exp,
    }
  }
  return getApiKeyUser(req)
}
