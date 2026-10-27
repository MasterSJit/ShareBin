import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { expireOverdueSubscriptions, getExpiringSubscriptions } from '@/lib/rbac'
import { auditLog } from '@/lib/paste-utils'
import { checkCronAuth } from '@/lib/cron-auth'

// ============================================================
// Subscription cron job — /api/cron/subscriptions
// POST (protected by CRON_SECRET when set) — runs maintenance:
//   1. expireOverdueSubscriptions() — marks active subs with past expiresAt as expired
//   2. finds subs expiring within 7 days → audit log entry `subscription_expiring_soon`
//   3. returns summary {expired, expiringSoon}
// ============================================================

export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied
  try {
    // 1. Expire overdue subscriptions
    const expired = await expireOverdueSubscriptions()

    // 2. Find subscriptions expiring within 7 days + audit log each (system actor).
    const expiringSoonList = await getExpiringSubscriptions(7)
    for (const sub of expiringSoonList) {
      await auditLog(null, 'subscription_expiring_soon', 'subscription', sub.id, {
        userId: sub.userId,
        userEmail: sub.user?.email,
        planId: sub.planId,
        planName: sub.plan?.name,
        status: sub.status,
        expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
      })
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
