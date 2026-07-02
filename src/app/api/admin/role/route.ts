import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/paste-utils'

async function requireAdminWithPerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const ok = await hasPermission(session.userId, perm)
  if (!ok && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

// ---- Roles CRUD ----
// GET /api/admin/role — list all roles with permissions
export async function GET(_req: NextRequest) {
  const { error, session } = await requireAdminWithPerm('admin:rbac')
  if (error || !session) return error

  const roles = await db.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  })
  const data = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isSystem: r.isSystem,
    createdAt: r.createdAt.toISOString(),
    userCount: r._count.users,
    permissions: r.permissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      description: rp.permission.description,
      category: rp.permission.category,
    })),
  }))
  return ok('Roles fetched', data)
}

// PUT /api/admin/role — create a new role
export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdminWithPerm('admin:rbac')
  if (error || !session) return error

  let body: { name?: string; description?: string; color?: string; permissionIds?: string[] } = {}
  try { body = await req.json() } catch { return badRequest('Invalid JSON') }
  if (!body.name) return badRequest('name is required')

  const existing = await db.role.findUnique({ where: { name: body.name } })
  if (existing) return badRequest('Role name already exists')

  const role = await db.role.create({
    data: {
      name: body.name,
      description: body.description || null,
      color: body.color || 'brand',
      isSystem: false,
    },
  })

  if (body.permissionIds?.length) {
    await db.rolePermission.createMany({
      data: body.permissionIds.map((pid) => ({ roleId: role.id, permissionId: pid })),
      skipDuplicates: true,
    })
  }

  await auditLog(session.userId, 'create_role', 'role', role.id, { name: role.name })
  return created('Role created', [{ id: role.id, name: role.name }])
}

// PATCH /api/admin/role — update a role (id in body)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdminWithPerm('admin:rbac')
  if (error || !session) return error

  let body: { id?: string; name?: string; description?: string; color?: string; permissionIds?: string[] } = {}
  try { body = await req.json() } catch { return badRequest('Invalid JSON') }
  if (!body.id) return badRequest('id is required')

  const role = await db.role.findUnique({ where: { id: body.id } })
  if (!role) return notFound('Role not found')

  const patch: Record<string, unknown> = {}
  if (body.name && body.name !== role.name) {
    const clash = await db.role.findUnique({ where: { name: body.name } })
    if (clash) return badRequest('Role name already exists')
    patch.name = body.name
  }
  if (typeof body.description === 'string') patch.description = body.description || null
  if (typeof body.color === 'string') patch.color = body.color

  const updated = await db.role.update({ where: { id: body.id }, data: patch })

  // Sync permissions if provided
  if (body.permissionIds !== undefined) {
    await db.rolePermission.deleteMany({ where: { roleId: body.id } })
    if (body.permissionIds.length) {
      await db.rolePermission.createMany({
        data: body.permissionIds.map((pid) => ({ roleId: body.id, permissionId: pid })),
        skipDuplicates: true,
      })
    }
  }

  await auditLog(session.userId, 'update_role', 'role', body.id, { after: patch })
  return ok('Role updated', [{ id: updated.id, name: updated.name }])
}

// DELETE /api/admin/role — delete a role (id in body)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAdminWithPerm('admin:rbac')
  if (error || !session) return error

  let body: { id?: string } = {}
  try { body = await req.json() } catch { return badRequest('Invalid JSON') }
  if (!body.id) return badRequest('id is required')

  const role = await db.role.findUnique({ where: { id: body.id } })
  if (!role) return notFound('Role not found')
  if (role.isSystem) return badRequest('System roles cannot be deleted')

  // Unassign users from this role
  await db.user.updateMany({ where: { roleId: body.id }, data: { roleId: null } })
  await db.role.delete({ where: { id: body.id } })

  await auditLog(session.userId, 'delete_role', 'role', body.id, { name: role.name })
  return ok('Role deleted', [])
}
