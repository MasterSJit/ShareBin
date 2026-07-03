import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, badRequest, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { parseJsonBody } from '@/lib/parse-body'
import { auditLog } from '@/lib/paste-utils'

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

function planToSafe(p: {
  id: string; name: string; description: string | null; monthlyPrice: number;
  maxStorageBytes: bigint; maxPasteSize: number; maxPastesPerMonth: number;
  allowedExpiryPresets: string; allowCustomExpiry: boolean; allowBurnAfterRead: boolean;
  allowPassword: boolean; allowPrivate: boolean; allowFileUpload: boolean;
  isSystem: boolean; isActive: boolean; sortOrder: number;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id, name: p.name, description: p.description, monthlyPrice: p.monthlyPrice,
    maxStorageBytes: Number(p.maxStorageBytes), maxPasteSize: p.maxPasteSize,
    maxPastesPerMonth: p.maxPastesPerMonth,
    allowedExpiryPresets: p.allowedExpiryPresets.split(',').map((s) => s.trim()).filter(Boolean),
    allowCustomExpiry: p.allowCustomExpiry, allowBurnAfterRead: p.allowBurnAfterRead,
    allowPassword: p.allowPassword, allowPrivate: p.allowPrivate, allowFileUpload: p.allowFileUpload,
    isSystem: p.isSystem, isActive: p.isActive, sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  }
}

// GET /api/admin/plan — list all plans
export async function GET(_req: NextRequest) {
  const session = await getSession()
  // Plans list is available to any authenticated user (so they can see upgrade options)
  if (!session) return unauthorized('Authentication required')

  const plans = await db.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  return ok('Plans fetched', plans.map(planToSafe))
}

// PUT /api/admin/plan — create a plan (admin only)
export async function PUT(req: NextRequest) {
  const { error, session } = await requirePerm('admin:plans')
  if (error || !session) return error

  const { data: body, error: je1 } = await parseJsonBody(req)
  if (je1 || !body) return badRequest(je1 || 'Invalid JSON')
  if (!body.name) return badRequest('name is required')

  const existing = await db.plan.findUnique({ where: { name: String(body.name) } })
  if (existing) return badRequest('Plan name already exists')

  const plan = await db.plan.create({
    data: {
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      monthlyPrice: Number(body.monthlyPrice) || 0,
      maxStorageBytes: BigInt(Number(body.maxStorageBytes) || 50 * 1024 * 1024),
      maxPasteSize: Number(body.maxPasteSize) || 5 * 1024 * 1024,
      maxPastesPerMonth: Number(body.maxPastesPerMonth) || 50,
      allowedExpiryPresets: Array.isArray(body.allowedExpiryPresets)
        ? (body.allowedExpiryPresets as string[]).join(',')
        : String(body.allowedExpiryPresets || 'never,10m,1h,1d,1w,1M,1y'),
      allowCustomExpiry: !!body.allowCustomExpiry,
      allowBurnAfterRead: body.allowBurnAfterRead !== false,
      allowPassword: body.allowPassword !== false,
      allowPrivate: !!body.allowPrivate,
      allowFileUpload: body.allowFileUpload !== false,
      isSystem: false,
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || 99,
    },
  })
  await auditLog(session.userId, 'create_plan', 'plan', plan.id, { name: plan.name })
  return created('Plan created', [planToSafe(plan)])
}

// PATCH /api/admin/plan — update a plan (id in body)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requirePerm('admin:plans')
  if (error || !session) return error

  const { data: body, error: je2 } = await parseJsonBody(req)
  if (je2 || !body) return badRequest(je2 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const plan = await db.plan.findUnique({ where: { id: String(body.id) } })
  if (!plan) return notFound('Plan not found')

  const patch: Record<string, unknown> = {}
  const fields = [
    'name', 'description', 'monthlyPrice', 'maxPasteSize', 'maxPastesPerMonth',
    'allowCustomExpiry', 'allowBurnAfterRead',
    'allowPassword', 'allowPrivate', 'allowFileUpload', 'isActive', 'sortOrder',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) patch[f] = body[f]
  }
  // allowedExpiryPresets: accept array OR string, store as comma-separated string
  if (body.allowedExpiryPresets !== undefined) {
    const val = body.allowedExpiryPresets
    patch.allowedExpiryPresets = Array.isArray(val) ? val.join(',') : String(val)
  }
  if (body.maxStorageBytes !== undefined) patch.maxStorageBytes = BigInt(Number(body.maxStorageBytes))

  const updated = await db.plan.update({ where: { id: String(body.id) }, data: patch })
  await auditLog(session.userId, 'update_plan', 'plan', plan.id, { after: patch })
  return ok('Plan updated', [planToSafe(updated)])
}

// DELETE /api/admin/plan — delete a plan (id in body)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requirePerm('admin:plans')
  if (error || !session) return error

  const { data: body, error: je3 } = await parseJsonBody<{ id?: string }>(req)
  if (je3 || !body) return badRequest(je3 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const plan = await db.plan.findUnique({ where: { id: body.id } })
  if (!plan) return notFound('Plan not found')
  if (plan.isSystem) return badRequest('System plans cannot be deleted')

  // Reassign users on this plan to Free
  const freePlan = await db.plan.findUnique({ where: { name: 'Free' } })
  if (freePlan) {
    await db.subscription.updateMany({
      where: { planId: body.id },
      data: { planId: freePlan.id },
    })
  }
  await db.plan.delete({ where: { id: body.id } })
  await auditLog(session.userId, 'delete_plan', 'plan', body.id, { name: plan.name })
  return ok('Plan deleted', [])
}
