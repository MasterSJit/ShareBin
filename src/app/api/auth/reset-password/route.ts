import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, unprocessable } from '@/lib/api-response'
import { hashPassword } from '@/lib/auth'

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const token = body.token
  const password = body.password
  if (!token || !password) return badRequest('token and password are required')
  if (password.length < 8) return unprocessable('Password must be at least 8 characters')

  const row = await db.siteSetting.findUnique({ where: { key: `reset:${token}` } })
  if (!row) return badRequest('Invalid or expired reset token')
  let payload: { userId?: string; expiresAt?: number }
  try {
    payload = JSON.parse(row.value)
  } catch {
    return badRequest('Invalid reset token payload')
  }
  if (!payload.userId || !payload.expiresAt || payload.expiresAt < Date.now()) {
    await db.siteSetting.delete({ where: { key: `reset:${token}` } })
    return badRequest('Reset token has expired')
  }

  const hash = await hashPassword(password)
  await db.user.update({ where: { id: payload.userId }, data: { passwordHash: hash } })
  await db.siteSetting.delete({ where: { key: `reset:${token}` } })
  return ok('Password reset successful', [])
}
