import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { auditLog } from '@/lib/paste-utils'
import type { SafeAuditLog } from '@/lib/types'

// GET /api/admin/audit — list recent admin actions
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))

  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { admin: true },
  })

  const safe: SafeAuditLog[] = rows.map((r) => ({
    id: r.id,
    adminId: r.adminId,
    adminEmail: r.admin?.email ?? null,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata ? safeJson(r.metadata) : null,
    createdAt: r.createdAt.toISOString(),
  }))

  return ok('Audit logs', safe)
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

// DELETE /api/admin/audit — clear all audit logs (admin only)
export async function DELETE() {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')
  if (session.role !== 'admin') return forbidden('Admin only')

  await db.auditLog.deleteMany({})
  // Record the clear action itself as a new entry.
  await auditLog(session.userId, 'clear_audit_log', 'audit', 'all', {})
  return ok('Audit log cleared', [])
}
