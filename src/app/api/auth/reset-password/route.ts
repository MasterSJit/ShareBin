import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, unprocessable, tooManyRequests } from '@/lib/api-response'
import { hashPassword, sha256, bumpSessionVersion, clientIp } from '@/lib/auth'
import { rateLimitHit } from '@/lib/cache'
import { auditLog } from '@/lib/paste-utils'

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 * Single-use; signs the user out everywhere (bumps sessionVersion).
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const token = body.token?.trim()
  const password = body.password
  if (!token || !password) return badRequest('token and password are required')
  if (password.length < 8) return unprocessable('Password must be at least 8 characters')

  if (rateLimitHit(`reset:${clientIp(req.headers)}`, 10, 15 * 60_000)) {
    return tooManyRequests('Too many attempts. Try again later.')
  }

  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.expiresAt < new Date()) {
    if (row) await db.passwordResetToken.delete({ where: { id: row.id } }).catch(() => {})
    return badRequest('Invalid or expired reset token')
  }

  await db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } })
  await db.passwordResetToken.deleteMany({ where: { userId: row.userId } })
  await bumpSessionVersion(row.userId)
  await auditLog(row.userId, 'password_reset', 'user', row.userId).catch(() => {})
  return ok('Password reset successful. Please log in with your new password.', [])
}
