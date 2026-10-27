import { NextRequest } from 'next/server'
import { ok, badRequest, notFound, gone, unauthorized, forbidden, tooManyRequests } from '@/lib/api-response'
import { getSession, comparePassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { isExpired } from '@/lib/paste-utils'
import {
  findPaste,
  canModerate,
  createUnlockToken,
  unlockCookieName,
  passwordAttemptBlocked,
  UNLOCK_TTL_SECONDS,
} from '@/lib/paste-access'

/**
 * POST /api/paste/unlock
 * Body: { id, password }
 *
 * On success returns `{ id, unlocked: true, token, expiresAt }` and sets an
 * httpOnly `ps_ul_<pasteId>` cookie. Browsers then just re-request the paste
 * (the cookie also covers <img>/<video>/download links); API clients send the
 * token in `x-unlock-token` or `?token=`. Tokens are bound to the current
 * password, so changing it revokes them. Attempts are rate-limited per IP.
 */
export async function POST(req: NextRequest) {
  let body: { id?: string; password?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const id = body.id
  const password = body.password
  if (!id || !password) return badRequest('id and password are required')

  const paste = await findPaste(id)
  if (!paste) return notFound('Paste not found')
  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('Paste is gone')
  if (!paste.passwordHash) return badRequest('This paste is not password-protected')

  // Private pastes still require session + access
  if (paste.visibility === 'private') {
    const session = await getSession()
    if (!session) return unauthorized('Login required')
    if (paste.ownerId !== session.userId && !(await canModerate(session))) {
      const grant = await db.pasteAccessGrant.findUnique({
        where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
      })
      if (!grant) return forbidden('No access')
    }
  }

  if (passwordAttemptBlocked(req, paste.id)) {
    return tooManyRequests('Too many password attempts. Try again in a minute.')
  }

  const match = await comparePassword(password, paste.passwordHash)
  if (!match) return unauthorized('Incorrect password')

  const token = createUnlockToken(paste)
  const res = ok('Paste unlocked', [
    {
      id: paste.id,
      slug: paste.slug,
      unlocked: true,
      token,
      expiresAt: new Date(Date.now() + UNLOCK_TTL_SECONDS * 1000).toISOString(),
    },
  ])
  res.cookies.set(unlockCookieName(paste.id), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    path: '/',
    maxAge: UNLOCK_TTL_SECONDS,
  })
  return res
}
