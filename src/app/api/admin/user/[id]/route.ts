import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, forbidden, notFound, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { auditLog } from '@/lib/paste-utils'
import { cacheDelPrefix } from '@/lib/cache'
import type { SafeUser } from '@/lib/types'

function toSafeUser(u: {
  id: string
  email: string
  displayName: string | null
  role: string
  status: string
  emailVerifiedAt: Date | null
  apiKey: string | null
  createdAt: Date
}): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as 'user' | 'admin',
    status: u.status as SafeUser['status'],
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    apiKey: u.apiKey,
    createdAt: u.createdAt.toISOString(),
  }
}

// PATCH /api/admin/user/[id] — same as /api/admin/user with id in body
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) return badRequest('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  let body: {
    status?: string
    role?: string
    displayName?: string
    verify?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  const patch: Record<string, unknown> = {}
  if (body.status && ['pending_verification', 'active', 'suspended', 'banned'].includes(body.status)) {
    patch.status = body.status
  }
  if (body.role && ['user', 'admin'].includes(body.role)) {
    if (target.id === session.userId) return badRequest('Cannot change your own role')
    patch.role = body.role
  }
  if (typeof body.displayName === 'string') {
    patch.displayName = body.displayName.trim().slice(0, 100) || null
  }
  if (body.verify) {
    patch.emailVerifiedAt = new Date()
    if (target.status === 'pending_verification') patch.status = 'active'
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')
  const updated = await db.user.update({ where: { id }, data: patch })
  cacheDelPrefix(`user:${id}`)
  await auditLog(session.userId, 'update_user', 'user', id, { after: patch })
  return ok('User updated', [toSafeUser(updated)])
}

// DELETE /api/admin/user/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const session = await getSession()
  if (!session) return badRequest('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')
  if (id === session.userId) return badRequest('Cannot delete your own account here')

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  await db.user.delete({ where: { id } })
  cacheDelPrefix(`user:${id}`)
  await auditLog(session.userId, 'delete_user', 'user', id, { email: target.email })
  return ok('User deleted', [])
}
