import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden, notFound, badRequest, gone } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { auditLog, isExpired } from '@/lib/paste-utils'
import { toSafePaste, invalidatePaste } from '@/lib/paste-access'
import { getStorage } from '@/lib/storage'

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  if (session.role !== 'admin') return { error: forbidden('Admin only') as Response, session: null }
  return { error: null, session }
}

// GET /api/admin/paste — list/search ALL pastes (including private, flagged, expired)
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.toLowerCase()
  const flagged = searchParams.get('flagged') === '1'
  const expired = searchParams.get('expired') === '1'

  const where: Record<string, unknown> = { isDeleted: false }
  if (flagged) where.isFlagged = true
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { slug: { contains: q } },
      { textContent: { contains: q } },
      { language: { contains: q } },
      { originalFileName: { contains: q } },
    ]
  }

  let rows = await db.paste.findMany({
    where,
    include: { owner: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  if (expired) {
    rows = rows.filter((p) => isExpired(p.expiresAt))
  } else {
    // by default also show expired (admin oversight), but not burned-deleted
  }

  return ok('Pastes fetched', rows.map((p) => toSafePaste(p, { includeContent: false })))
}

// PATCH /api/admin/paste — flag/unflag/force-expire/edit any paste
export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  let body: {
    id?: string
    isFlagged?: boolean
    visibility?: string
    expiresAt?: string | null
    forceExpire?: boolean
    title?: string
    description?: string
    tags?: string
    language?: string
    textContent?: string
    viewCount?: number
    resetViews?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }], isDeleted: false },
  })
  if (!paste) return notFound('Paste not found')

  const patch: Record<string, unknown> = {}
  if (typeof body.isFlagged === 'boolean') patch.isFlagged = body.isFlagged
  if (body.visibility && ['public', 'unlisted', 'private'].includes(body.visibility)) {
    patch.visibility = body.visibility
  }
  if (typeof body.title === 'string') patch.title = body.title.slice(0, 255) || null
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 1000) || null
  if (typeof body.tags === 'string') patch.tags = body.tags.slice(0, 500) || null
  if (typeof body.language === 'string') patch.language = body.language.slice(0, 50)
  if (typeof body.textContent === 'string' && paste.contentType === 'text') {
    patch.textContent = body.textContent.slice(0, 5 * 1024 * 1024)
  }
  if (typeof body.viewCount === 'number' && body.viewCount >= 0) patch.viewCount = body.viewCount
  if (body.resetViews) patch.viewCount = 0
  if (body.forceExpire) patch.expiresAt = new Date(Date.now() - 1000)
  else if (body.expiresAt === null) patch.expiresAt = null
  else if (body.expiresAt) {
    const d = new Date(body.expiresAt)
    if (!isNaN(d.getTime())) patch.expiresAt = d
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')
  const updated = await db.paste.update({ where: { id: paste.id }, data: patch, include: { owner: true } })
  invalidatePaste(paste.slug)
  invalidatePaste(paste.id)
  await auditLog(session.userId, 'update_paste', 'paste', paste.id, { after: patch })
  return ok('Paste updated', [toSafePaste(updated)])
}

// DELETE /api/admin/paste — force delete any paste (also deletes storage)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  let body: { id?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* allow empty */
  }
  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const paste = await db.paste.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  })
  if (!paste) return notFound('Paste not found')

  // Hard-delete (storage file + record + grants + audit log)
  const { hardDeletePaste } = await import('@/lib/cleanup')
  await hardDeletePaste(paste.id, 'admin', session.userId)
  return ok('Paste permanently deleted', [])
}
