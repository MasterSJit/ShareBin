import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, forbidden, badRequest } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/admin/permission — list all permissions
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return badRequest('Authentication required')
  const okp = await hasPermission(session.userId, 'admin:rbac')
  if (!okp && session.role !== 'admin') return forbidden('Insufficient permissions')

  const perms = await db.permission.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
  const grouped: Record<string, typeof perms> = {}
  for (const p of perms) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }
  return ok('Permissions fetched', perms.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
  })))
}
