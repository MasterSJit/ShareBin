import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, gone, unauthorized, forbidden } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { isExpired } from '@/lib/paste-utils'
import { findPaste, invalidatePaste, toSafePaste } from '@/lib/paste-access'

// GET /api/paste/[id] — same logic as /api/paste?id= (delegates)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return notFound('Paste not found')

  if (paste.visibility === 'private') {
    if (!session) return unauthorized('Login required to view this private paste')
    if (paste.ownerId !== session.userId && session.role !== 'admin') {
      if (paste.ownerId) {
        const grant = await db.pasteAccessGrant.findUnique({
          where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
        })
        if (!grant) return forbidden('You do not have access to this private paste')
      } else {
        return forbidden('You do not have access to this private paste')
      }
    }
  }

  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('Paste is gone')

  const unlockedHeader = req.headers.get('x-unlocked') || ''
  const unlocked = new Set(unlockedHeader.split(',').filter(Boolean))
  const needsPassword =
    !!paste.passwordHash &&
    !unlocked.has(paste.id) &&
    !(session && (session.userId === paste.ownerId || session.role === 'admin'))
  if (needsPassword) {
    return ok('Password required', [
      { ...toSafePaste(paste, { includeContent: false }), passwordRequired: true },
    ])
  }

  if (paste.burnAfterRead && !paste.isBurned) {
    await db.paste.update({
      where: { id: paste.id },
      data: { isBurned: true, viewCount: { increment: 1 } },
    })
    invalidatePaste(paste.slug)
    invalidatePaste(paste.id)
  } else {
    await db.paste.update({ where: { id: paste.id }, data: { viewCount: { increment: 1 } } })
  }

  return ok('Paste fetched', [toSafePaste(paste, { includeContent: true })])
}
