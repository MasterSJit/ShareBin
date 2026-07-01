import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, notFound, gone, unauthorized, forbidden } from '@/lib/api-response'
import { getSession, comparePassword } from '@/lib/auth'
import { isExpired } from '@/lib/paste-utils'
import { findPaste } from '@/lib/paste-access'

/**
 * POST /api/paste/unlock
 * Body: { id, password }
 * Returns 200 if password is correct; the frontend then re-requests the paste
 * with `x-unlocked: <pasteId>` header.
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
    if (paste.ownerId !== session.userId && session.role !== 'admin') {
      const grant = paste.ownerId
        ? await db.pasteAccessGrant.findUnique({
            where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
          })
        : null
      if (!grant) return forbidden('No access')
    }
  }

  const match = await comparePassword(password, paste.passwordHash)
  if (!match) return unauthorized('Incorrect password')

  return ok('Paste unlocked', [{ id: paste.id, unlocked: true }])
}
