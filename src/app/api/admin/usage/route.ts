import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden, badRequest, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission, getActiveSubscription, recomputeUsage } from '@/lib/rbac'

// GET /api/admin/usage — list all users' usage (admin)
// GET /api/admin/usage?userId=X — specific user (admin)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  // If userId is provided, return that user's usage (admin or self)
  if (userId) {
    if (userId !== session.userId) {
      const okp = await hasPermission(session.userId, 'admin:subscriptions')
      if (!okp && session.role !== 'admin') return forbidden('Insufficient permissions')
    }
    const usage = await recomputeUsage(userId)
    const sub = await getActiveSubscription(userId)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, role: true },
    })
    if (!user) return notFound('User not found')

    return ok('Usage fetched', [{
      user,
      subscription: sub ? {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt.toISOString(),
        expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
        plan: { id: sub.plan.id, name: sub.plan.name, maxStorageBytes: Number(sub.plan.maxStorageBytes) },
      } : null,
      usage: {
        storageBytes: Number(usage.storageBytes),
        pasteCount: usage.pasteCount,
        fileCount: usage.fileCount,
        monthPasteCount: usage.monthPasteCount,
        totalPastes: usage.totalPastes,
        totalViews: usage.totalViews,
        monthResetAt: usage.monthResetAt.toISOString(),
      },
    }])
  }

  // List all users' usage (admin only)
  const okp = await hasPermission(session.userId, 'admin:subscriptions')
  if (!okp && session.role !== 'admin') return forbidden('Insufficient permissions')

  const records = await db.usageRecord.findMany({
    include: {
      user: {
        select: {
          id: true, email: true, displayName: true, role: true, status: true,
          subscriptions: {
            where: { status: 'active' },
            include: { plan: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { storageBytes: 'desc' },
    take: 200,
  })

  const data = records.map((r) => ({
    user: {
      id: r.user.id, email: r.user.email, displayName: r.user.displayName,
      role: r.user.role, status: r.user.status,
    },
    subscription: r.user.subscriptions[0] ? {
      id: r.user.subscriptions[0].id,
      status: r.user.subscriptions[0].status,
      expiresAt: r.user.subscriptions[0].expiresAt ? r.user.subscriptions[0].expiresAt!.toISOString() : null,
      plan: {
        id: r.user.subscriptions[0].plan.id,
        name: r.user.subscriptions[0].plan.name,
        maxStorageBytes: Number(r.user.subscriptions[0].plan.maxStorageBytes),
      },
    } : null,
    usage: {
      storageBytes: Number(r.storageBytes),
      pasteCount: r.pasteCount,
      fileCount: r.fileCount,
      monthPasteCount: r.monthPasteCount,
      totalPastes: r.totalPastes,
      totalViews: r.totalViews,
    },
  }))

  return ok('Usage fetched', data)
}
