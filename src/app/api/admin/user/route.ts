import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { auditLog } from '@/lib/paste-utils'
import { cacheDelPrefix } from '@/lib/cache'
import type { SafeUser } from '@/lib/types'

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  if (session.role !== 'admin') return { error: forbidden('Admin only') as Response, session: null }
  return { error: null, session }
}

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

// GET /api/admin/user — list/search all users
export async function GET(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.toLowerCase()
  const status = searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { displayName: { contains: q } },
    ]
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const ids = users.map((u) => u.id)
  const counts = await db.paste.groupBy({
    by: ['ownerId'],
    where: { ownerId: { in: ids }, isDeleted: false },
    _count: { _all: true },
  })
  const countMap = new Map(counts.map((c) => [c.ownerId, c._count._all]))

  return ok('Users fetched', users.map((u) => ({ ...toSafeUser(u), pasteCount: countMap.get(u.id) ?? 0 })))
}

// PATCH /api/admin/user — ban/suspend/verify/edit any user
export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  let body: {
    id?: string
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
  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  const patch: Record<string, unknown> = {}
  const meta: Record<string, unknown> = { before: { status: target.status, role: target.role } }

  if (body.status && ['pending_verification', 'active', 'suspended', 'banned'].includes(body.status)) {
    patch.status = body.status
  }
  if (body.role && ['user', 'admin'].includes(body.role)) {
    if (target.id === session.userId) {
      return badRequest('Cannot change your own role')
    }
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
  await auditLog(session.userId, 'update_user', 'user', id, { ...meta, after: patch })
  return ok('User updated', [toSafeUser(updated)])
}

// DELETE /api/admin/user — delete any user
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
  if (id === session.userId) return badRequest('Cannot delete your own account here')

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  try {
    await db.user.delete({ where: { id } })
    cacheDelPrefix(`user:${id}`)
    await auditLog(session.userId, 'delete_user', 'user', id, { email: target.email })
    return ok('User deleted', [])
  } catch (e) {
    return serverError('Failed to delete user: ' + (e as Error).message)
  }
}
