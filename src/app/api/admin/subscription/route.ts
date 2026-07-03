import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, badRequest, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission, getExpiringSubscriptions, expireOverdueSubscriptions } from '@/lib/rbac'
import { auditLog } from '@/lib/paste-utils'
import { parseJsonBody } from '@/lib/parse-body'

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

function subToSafe(s: {
  id: string; userId: string; planId: string; status: string;
  startedAt: Date; expiresAt: Date | null; createdAt: Date; updatedAt: Date;
  user: { id: string; email: string; displayName: string | null } | null;
  plan: { id: string; name: string; monthlyPrice: number } | null;
}) {
  return {
    id: s.id, userId: s.userId, planId: s.planId, status: s.status,
    startedAt: s.startedAt.toISOString(),
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    user: s.user ? { id: s.user.id, email: s.user.email, displayName: s.user.displayName } : null,
    plan: s.plan ? { id: s.plan.id, name: s.plan.name, monthlyPrice: s.plan.monthlyPrice } : null,
  }
}

// GET /api/admin/subscription — list all subscriptions (with filters)
export async function GET(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // active | expired | expiring
  const expiring = searchParams.get('expiring') === '1'

  // Expire overdue subscriptions first
  await expireOverdueSubscriptions()

  if (expiring) {
    const list = await getExpiringSubscriptions(7)
    return ok('Expiring subscriptions', list.map((s) => subToSafe(s as never)))
  }

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const subs = await db.subscription.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      plan: { select: { id: true, name: true, monthlyPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok('Subscriptions fetched', subs.map(subToSafe))
}

// PUT /api/admin/subscription — assign a plan to a user (create subscription)
export async function PUT(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je1 } = await parseJsonBody<{ userId?: string; planId?: string; expiresAt?: string | null; status?: string }>(req)
  if (je1 || !body) return badRequest(je1 || 'Invalid JSON')
  if (!body.userId || !body.planId) return badRequest('userId and planId are required')

  const user = await db.user.findUnique({ where: { id: body.userId } })
  if (!user) return notFound('User not found')
  const plan = await db.plan.findUnique({ where: { id: body.planId } })
  if (!plan) return notFound('Plan not found')

  // Expire existing active subscriptions for this user
  await db.subscription.updateMany({
    where: { userId: body.userId, status: 'active' },
    data: { status: 'cancelled' },
  })

  const sub = await db.subscription.create({
    data: {
      userId: body.userId,
      planId: body.planId,
      status: body.status || 'active',
      expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : null,
    },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      plan: { select: { id: true, name: true, monthlyPrice: true } },
    },
  })
  await auditLog(session.userId, 'assign_subscription', 'subscription', sub.id, {
    userId: body.userId, planId: body.planId, planName: plan.name,
  })
  return created('Subscription assigned', [subToSafe(sub)])
}

// PATCH /api/admin/subscription — update a subscription (id in body)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je2 } = await parseJsonBody<{ id?: string; status?: string; expiresAt?: string | null; planId?: string }>(req)
  if (je2 || !body) return badRequest(je2 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const sub = await db.subscription.findUnique({ where: { id: body.id } })
  if (!sub) return notFound('Subscription not found')

  const patch: Record<string, unknown> = {}
  if (body.status) patch.status = body.status
  if (body.planId) patch.planId = body.planId
  if (body.expiresAt !== undefined) {
    patch.expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt)
  }

  const updated = await db.subscription.update({
    where: { id: body.id },
    data: patch,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      plan: { select: { id: true, name: true, monthlyPrice: true } },
    },
  })
  await auditLog(session.userId, 'update_subscription', 'subscription', body.id, { after: patch })
  return ok('Subscription updated', [subToSafe(updated)])
}

// DELETE /api/admin/subscription — cancel a subscription (id in body)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je3 } = await parseJsonBody<{ id?: string }>(req)
  if (je3 || !body) return badRequest(je3 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const sub = await db.subscription.findUnique({ where: { id: body.id } })
  if (!sub) return notFound('Subscription not found')

  await db.subscription.update({ where: { id: body.id }, data: { status: 'cancelled' } })
  await auditLog(session.userId, 'cancel_subscription', 'subscription', body.id, {})
  return ok('Subscription cancelled', [])
}
