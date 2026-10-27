import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, tooManyRequests } from '@/lib/api-response'
import { generateToken, sha256, clientIp } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import { siteBaseUrl } from '@/lib/paste-create'
import { sendMail, mailConfigured } from '@/lib/mailer'

const RESET_TTL_MS = 30 * 60 * 1000 // 30 min

/**
 * Returning the token in the HTTP response lets *anyone* reset *any* account,
 * so it is only done in development (or when explicitly enabled for a demo).
 */
function exposeTokenInResponse(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_INSECURE_RESET_TOKENS === '1'
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always answers 200 (no account enumeration). Stores only a SHA-256 of the
 * token. Delivery: email via lib/mailer when configured; in development the
 * token is also returned in the response so the UI can continue directly.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const email = body.email?.trim().toLowerCase()
  if (!email) return badRequest('email is required')

  if (rateLimitHit(`forgot:${clientIp(req.headers)}`, 5, 15 * 60_000)) {
    return tooManyRequests('Too many reset requests. Try again later.')
  }

  const generic = ok('If the email exists, a reset link has been sent', [])
  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.status === 'banned') return generic

  const token = generateToken()
  // One live token per user.
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } })
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })

  const link = `${await siteBaseUrl(req)}/#/reset?token=${token}`
  if (mailConfigured()) {
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      text: `Someone asked to reset the password for this account.\n\nReset link (valid 30 minutes):\n${link}\n\nIf this wasn't you, ignore this email.`,
    }).catch((e) => console.error('[forgot-password] mail failed:', e))
  }

  if (exposeTokenInResponse()) {
    return ok('Reset token generated (development mode returns it directly)', [{ token, link }])
  }
  return generic
}
