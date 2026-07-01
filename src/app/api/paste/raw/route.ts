import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, gone, unauthorized, forbidden, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { isExpired } from '@/lib/paste-utils'
import { findPaste } from '@/lib/paste-access'

// GET /api/paste/raw?id=slug  OR  /api/paste/raw/[id] — plain-text body
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return badRequest('id query param is required')

  const session = await getSession()
  const paste = await findPaste(id)
  if (!paste) return notFound('Paste not found')

  if (paste.contentType !== 'text') {
    return badRequest('Raw view is only available for text pastes')
  }

  if (paste.visibility === 'private') {
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

  if (isExpired(paste.expiresAt) || paste.isBurned) return gone('Paste is gone')

  const unlockedHeader = req.headers.get('x-unlocked') || ''
  const unlocked = new Set(unlockedHeader.split(',').filter(Boolean))
  if (
    paste.passwordHash &&
    !unlocked.has(paste.id) &&
    !(session && (session.userId === paste.ownerId || session.role === 'admin'))
  ) {
    return forbidden('Password required — POST /api/paste/unlock first')
  }

  // Return plain text (NOT wrapped in envelope, per spec — raw endpoint)
  return new Response(paste.textContent || '', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
