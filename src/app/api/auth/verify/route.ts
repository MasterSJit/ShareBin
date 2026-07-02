import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'

/**
 * POST /api/auth/verify
 * In the sandbox (no SMTP) we auto-verify on registration, so this endpoint
 * simply marks the current user as verified if for some reason they aren't.
 * Body: { token?: string } — token is accepted for spec-compatibility but
 * not strictly required here.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return badRequest('No active session')
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return notFound('User not found')
  if (!user.emailVerifiedAt) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: 'active' },
    })
  }
  return ok('Email verified', [{ id: user.id, verified: true }])
}
