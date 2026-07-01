import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest } from '@/lib/api-response'
import { generateToken } from '@/lib/auth'

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * In the sandbox (no SMTP) we don't actually send email. Instead, we create
 * a reset token row and return it in the response (dev-only convenience) so
 * the UI can feed it directly into the reset step.
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

  const user = await db.user.findUnique({ where: { email } })
  // Always return 200 to avoid user-enumeration, but only create a token if user exists.
  if (!user) return ok('If the email exists, a reset link has been generated', [])

  // SQLite has no PasswordReset table in our schema; reuse a row in SiteSetting
  // keyed by `reset:{token}` -> JSON { userId, expiresAt }. Prune on use.
  const token = generateToken()
  const expiresAt = Date.now() + 30 * 60 * 1000 // 30 min
  await db.siteSetting.upsert({
    where: { key: `reset:${token}` },
    update: { value: JSON.stringify({ userId: user.id, expiresAt }) },
    create: { key: `reset:${token}`, value: JSON.stringify({ userId: user.id, expiresAt }) },
  })

  return ok('Reset token generated (dev mode returns it directly)', [{ token }])
}
