import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, forbidden, notFound, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { auditLog } from '@/lib/paste-utils'
import { toSafePaste, invalidatePaste } from '@/lib/paste-access'
import { getStorage } from '@/lib/storage'

// PATCH /api/admin/paste/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) return badRequest('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  let body: {
    isFlagged?: boolean
    visibility?: string
    expiresAt?: string | null
    forceExpire?: boolean
    title?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const paste = await db.paste.findFirst({ where: { OR: [{ id }, { slug: id }] } })
  if (!paste) return notFound('Paste not found')

  const patch: Record<string, unknown> = {}
  if (typeof body.isFlagged === 'boolean') patch.isFlagged = body.isFlagged
  if (body.visibility && ['public', 'unlisted', 'private'].includes(body.visibility)) {
    patch.visibility = body.visibility
  }
  if (typeof body.title === 'string') patch.title = body.title.slice(0, 255) || null
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

// DELETE /api/admin/paste/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) return badRequest('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  const paste = await db.paste.findFirst({ where: { OR: [{ id }, { slug: id }] } })
  if (!paste) return notFound('Paste not found')

  await db.paste.update({ where: { id: paste.id }, data: { isDeleted: true } })
  invalidatePaste(paste.slug)
  invalidatePaste(paste.id)
  if (paste.storageKey && paste.contentType === 'file') {
    await getStorage().delete(paste.storageKey)
  }
  await auditLog(session.userId, 'delete_paste', 'paste', paste.id, {
    slug: paste.slug,
    title: paste.title,
    contentType: paste.contentType,
  })
  return ok('Paste deleted', [])
}
