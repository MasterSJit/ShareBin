import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, unauthorized, forbidden, notFound, badRequest, conflict, serverError } from '@/lib/api-response'
import { getSession, hashPassword, generateApiKey, bumpSessionVersion } from '@/lib/auth'
import { auditLog } from '@/lib/paste-utils'
import { cacheDelPrefix } from '@/lib/cache'
import { parseJsonBody } from '@/lib/parse-body'
import { hardDeleteUserPastes } from '@/lib/cleanup'
import { toSafeUser } from '@/lib/user-safe'

const VALID_STATUSES = ['pending_verification', 'active', 'suspended', 'banned']

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  if (session.role !== 'admin') return { error: forbidden('Admin only') as Response, session: null }
  return { error: null, session }
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

// PUT /api/admin/user — create a new user (admin-created)
export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  const { data: body, error: jsonErr } = await parseJsonBody<{
    email?: string
    password?: string
    displayName?: string
    role?: string
    roleId?: string
    status?: string
    autoVerify?: boolean
  }>(req)
  if (jsonErr || !body) return badRequest(jsonErr || 'Invalid JSON')

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) return badRequest('email and password are required')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest('Invalid email format')
  if (password.length < 8) return badRequest('Password must be at least 8 characters')

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return conflict('Email already registered')

  const hash = await hashPassword(password)

  // Resolve role: if roleId provided, look up the role name; if role name provided, use it directly.
  let resolvedRole = 'user'
  let resolvedRoleId: string | null = null
  if (body.roleId) {
    const roleRec = await db.role.findUnique({ where: { id: body.roleId } })
    if (roleRec) {
      resolvedRole = roleRec.name
      resolvedRoleId = roleRec.id
    }
  } else if (body.role) {
    // Try to find by name
    const roleRec = await db.role.findUnique({ where: { name: body.role } })
    if (roleRec) {
      resolvedRole = roleRec.name
      resolvedRoleId = roleRec.id
    } else {
      resolvedRole = body.role
    }
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: hash,
      displayName: body.displayName?.trim().slice(0, 100) || null,
      role: resolvedRole,
      roleId: resolvedRoleId,
      status: VALID_STATUSES.includes(body.status || '') ? body.status! : 'active',
      emailVerifiedAt: body.autoVerify !== false ? new Date() : null,
    },
  })

  await auditLog(session.userId, 'create_user', 'user', user.id, { email: user.email, role: user.role })
  return created('User created', [toSafeUser(user)])
}

// PATCH /api/admin/user — update any user (full edit: name, email, role, status, roleId, password, apiKey)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  const { data: body, error: jsonErr } = await parseJsonBody<{
    id?: string
    status?: string
    role?: string
    roleId?: string
    displayName?: string
    email?: string
    password?: string
    verify?: boolean
    regenerateApiKey?: boolean
  }>(req)
  if (jsonErr || !body) return badRequest(jsonErr || 'Invalid JSON')

  const { searchParams } = new URL(req.url)
  const id = body.id || searchParams.get('id')
  if (!id) return badRequest('id is required')

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  const patch: Record<string, unknown> = {}
  const meta: Record<string, unknown> = { before: { status: target.status, role: target.role, email: target.email, displayName: target.displayName } }

  if (body.status && VALID_STATUSES.includes(body.status)) {
    if (target.id === session.userId && body.status !== 'active') {
      return badRequest('Cannot suspend or ban your own account')
    }
    patch.status = body.status
  }
  // Role: accept any role name that exists in the Role table. Also resolve roleId.
  if (body.roleId !== undefined) {
    if (target.id === session.userId) {
      return badRequest('Cannot change your own role')
    }
    if (body.roleId === '' || body.roleId === null) {
      patch.roleId = null
      patch.role = 'user'
    } else {
      const roleRec = await db.role.findUnique({ where: { id: body.roleId } })
      if (!roleRec) return badRequest('Role not found')
      patch.roleId = roleRec.id
      patch.role = roleRec.name
    }
  } else if (body.role && body.role !== target.role) {
    if (target.id === session.userId) {
      return badRequest('Cannot change your own role')
    }
    // Look up the role by name to get its id
    const roleRec = await db.role.findUnique({ where: { name: body.role } })
    if (roleRec) {
      patch.role = roleRec.name
      patch.roleId = roleRec.id
    } else {
      // Allow custom role names even if not in the Role table
      patch.role = body.role
    }
  }
  if (typeof body.displayName === 'string') {
    patch.displayName = body.displayName.trim().slice(0, 100) || null
  }
  if (typeof body.email === 'string' && body.email !== target.email) {
    const email = body.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest('Invalid email format')
    const clash = await db.user.findUnique({ where: { email } })
    if (clash) return conflict('Email already in use')
    patch.email = email
  }
  if (body.password) {
    if (body.password.length < 8) return badRequest('Password must be at least 8 characters')
    patch.passwordHash = await hashPassword(body.password)
  }
  if (body.verify) {
    patch.emailVerifiedAt = new Date()
    if (target.status === 'pending_verification') patch.status = 'active'
  }
  if (body.regenerateApiKey) {
    patch.apiKey = generateApiKey()
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')

  const updated = await db.user.update({ where: { id }, data: patch })
  cacheDelPrefix(`user:${id}`)
  // A new password or a ban/suspension signs the user out of every device.
  if (patch.passwordHash || patch.status === 'banned' || patch.status === 'suspended') {
    await bumpSessionVersion(id)
  }
  const { passwordHash: _omit, ...loggable } = patch
  await auditLog(session.userId, 'update_user', 'user', id, {
    ...meta,
    after: { ...loggable, ...(patch.passwordHash ? { password: '(changed)' } : {}) },
  })
  return ok('User updated', [toSafeUser(updated)])
}

// DELETE /api/admin/user — delete any user
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error || !session) return error

  const { data: body, error: jsonErr } = await parseJsonBody<{ id?: string }>(req)
  if (jsonErr) return badRequest(jsonErr)

  const { searchParams } = new URL(req.url)
  const id = body?.id || searchParams.get('id')
  if (!id) return badRequest('id is required')
  if (id === session.userId) return badRequest('Cannot delete your own account here')

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return notFound('User not found')

  try {
    // The admin UI promises "delete the user and all their pastes".
    const deletedPastes = await hardDeleteUserPastes(id, session.userId)
    await db.user.delete({ where: { id } })
    cacheDelPrefix(`user:${id}`)
    await auditLog(session.userId, 'delete_user', 'user', id, { email: target.email, deletedPastes })
    return ok('User deleted', [{ deletedPastes }])
  } catch (e) {
    return serverError('Failed to delete user: ' + (e as Error).message)
  }
}
