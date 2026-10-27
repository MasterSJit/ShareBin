import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, serverError } from '@/lib/api-response'
import { expireOverdueSubscriptions, getExpiringSubscriptions } from '@/lib/rbac'
import { auditLog } from '@/lib/paste-utils'

// ============================================================
// Subscription cron job — /api/cron/subscriptions
// POST (no auth, endpoint path is the secret) — runs maintenance:
//   1. expireOverdueSubscriptions() — marks active subs with past expiresAt as expired
//   2. finds subs expiring within 7 days → audit log entry `subscription_expiring_soon`
//   3. returns summary {expired, expiringSoon}
// ============================================================

export async function POST(_req: NextRequest) {
  try {
    // 1. Expire overdue subscriptions
    const expired = await expireOverdueSubscriptions()

    // 2. Find subscriptions expiring within 7 days + audit log each.
    // The AuditLog.adminId column is a FK to User, so attribute to the first
    // admin user (system context).
    const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
    const expiringSoonList = await getExpiringSubscriptions(7)
    if (admin) {
      for (const sub of expiringSoonList) {
        await auditLog(admin.id, 'subscription_expiring_soon', 'subscription', sub.id, {
          userId: sub.userId,
          userEmail: sub.user?.email,
          planId: sub.planId,
          planName: sub.plan?.name,
          status: sub.status,
          expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
        })
      }
    }

    return ok('Subscription maintenance completed', [
      {
        expired,
        expiringSoon: expiringSoonList.length,
      },
    ])
  } catch (e) {
    return serverError('Subscription maintenance failed: ' + (e as Error).message)
  }
}

// Allow GET for simple cron triggers
export async function GET(req: NextRequest) {
  return POST(req)
}
