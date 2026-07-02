import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { getUserLimits, getActiveSubscription, getOrCreateUsage } from '@/lib/rbac'

// GET /api/me/limits — current user's plan, limits, and usage
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const limits = await getUserLimits(session.userId)
  const sub = await getActiveSubscription(session.userId)
  const usage = await getOrCreateUsage(session.userId)
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, role: true, roleId: true },
  })

  return ok('Your plan & limits', [{
    user,
    plan: {
      name: limits.planName,
      planId: limits.planId,
      maxStorageBytes: limits.maxStorageBytes,
      maxPasteSize: limits.maxPasteSize,
      maxPastesPerMonth: limits.maxPastesPerMonth,
      allowedExpiryPresets: limits.allowedExpiryPresets,
      allowCustomExpiry: limits.allowCustomExpiry,
      allowBurnAfterRead: limits.allowBurnAfterRead,
      allowPassword: limits.allowPassword,
      allowPrivate: limits.allowPrivate,
      allowFileUpload: limits.allowFileUpload,
    },
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      startedAt: sub.startedAt.toISOString(),
      expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
      planName: sub.plan.name,
      monthlyPrice: sub.plan.monthlyPrice,
    } : null,
    usage: {
      storageBytes: Number(usage.storageBytes),
      pasteCount: usage.pasteCount,
      fileCount: usage.fileCount,
      monthPasteCount: usage.monthPasteCount,
      totalPastes: usage.totalPastes,
      totalViews: usage.totalViews,
    },
  }])
}
