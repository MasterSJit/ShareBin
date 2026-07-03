import { db } from '@/lib/db'

// ============================================================
// RBAC — permission checks
// ============================================================

export type PermissionName = string // e.g., "paste:create"

/** Get all permission names for a user (via their role). */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  })
  if (!user || !user.roleRef) return new Set()
  return new Set(user.roleRef.permissions.map((rp) => rp.permission.name))
}

/** Check if a user has a specific permission. */
export async function hasPermission(userId: string, permission: PermissionName): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.has(permission)
}

/** Check if a user has ANY of the given permissions. */
export async function hasAnyPermission(userId: string, permissions: PermissionName[]): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return permissions.some((p) => perms.has(p))
}

/** Require a permission — throws 403-style error if missing. Returns the session if OK. */
export async function requirePermission(
  userId: string,
  permission: PermissionName
): Promise<void> {
  const ok = await hasPermission(userId, permission)
  if (!ok) {
    throw new PermissionDeniedError(`Missing permission: ${permission}`)
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

// ============================================================
// Plans & Limits — subscription enforcement
// ============================================================

export type Plan = {
  id: string
  name: string
  description: string | null
  monthlyPrice: number
  maxStorageBytes: bigint
  maxPasteSize: number
  maxPastesPerMonth: number
  allowedExpiryPresets: string
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
  isSystem: boolean
  isActive: boolean
  sortOrder: number
}

export type PlanLimits = {
  maxStorageBytes: number
  maxPasteSize: number
  maxPastesPerMonth: number
  allowedExpiryPresets: string[]
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
  planName: string
  planId: string
}

/** Default Free-tier limits (used for guests and users without a subscription). */
export const FREE_LIMITS: PlanLimits = {
  maxStorageBytes: 10 * 1024 * 1024, // 10 MB for guests
  maxPasteSize: 1024 * 1024, // 1 MB for guests
  maxPastesPerMonth: 10,
  allowedExpiryPresets: ['never', '10m', '1h', '1d'],
  allowCustomExpiry: false,
  allowBurnAfterRead: true, // free for everyone
  allowPassword: false,
  allowPrivate: false,
  allowFileUpload: false,
  planName: 'Guest',
  planId: '',
}

/** Get the active subscription for a user, or null. */
export async function getActiveSubscription(userId: string) {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
  return sub
}

/** Get the effective plan limits for a user (or guest limits if no subscription). */
export async function getUserLimits(userId: string | null): Promise<PlanLimits> {
  if (!userId) return FREE_LIMITS

  const sub = await getActiveSubscription(userId)
  if (!sub) {
    // Fall back to the "Free" plan if it exists
    const freePlan = await db.plan.findUnique({ where: { name: 'Free' } })
    if (!freePlan) return { ...FREE_LIMITS, planName: 'Free' }
    return planToLimits(freePlan)
  }

  return planToLimits(sub.plan)
}

function planToLimits(plan: {
  id: string
  name: string
  maxStorageBytes: bigint
  maxPasteSize: number
  maxPastesPerMonth: number
  allowedExpiryPresets: string
  allowCustomExpiry: boolean
  allowBurnAfterRead: boolean
  allowPassword: boolean
  allowPrivate: boolean
  allowFileUpload: boolean
}): PlanLimits {
  return {
    maxStorageBytes: Number(plan.maxStorageBytes),
    maxPasteSize: plan.maxPasteSize,
    maxPastesPerMonth: plan.maxPastesPerMonth,
    allowedExpiryPresets: plan.allowedExpiryPresets.split(',').map((s) => s.trim()).filter(Boolean),
    allowCustomExpiry: plan.allowCustomExpiry,
    allowBurnAfterRead: plan.allowBurnAfterRead,
    allowPassword: plan.allowPassword,
    allowPrivate: plan.allowPrivate,
    allowFileUpload: plan.allowFileUpload,
    planName: plan.name,
    planId: plan.id,
  }
}

// ============================================================
// Usage tracking
// ============================================================

/** Get or create the usage record for a user. */
export async function getOrCreateUsage(userId: string) {
  const now = new Date()
  let record = await db.usageRecord.findUnique({ where: { userId } })
  if (!record) {
    record = await db.usageRecord.create({ data: { userId } })
  }

  // Reset monthly counter if a month has passed
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  if (record.monthResetAt < monthStart) {
    record = await db.usageRecord.update({
      where: { userId },
      data: { monthPasteCount: 0, monthResetAt: now },
    })
  }
  return record
}

/** Recompute cached usage stats from the Paste table. */
export async function recomputeUsage(userId: string) {
  const pastes = await db.paste.findMany({
    where: { ownerId: userId, isDeleted: false },
    select: { contentType: true, fileSizeBytes: true, viewCount: true },
  })
  const storageBytes = pastes.reduce((s, p) => s + (p.fileSizeBytes || 0), 0)
  const pasteCount = pastes.filter((p) => p.contentType === 'text').length
  const fileCount = pastes.filter((p) => p.contentType === 'file').length
  const totalViews = pastes.reduce((s, p) => s + p.viewCount, 0)

  const record = await getOrCreateUsage(userId)
  return db.usageRecord.update({
    where: { userId },
    data: {
      storageBytes: BigInt(storageBytes),
      pasteCount,
      fileCount,
      totalViews,
      totalPastes: pasteCount + fileCount,
    },
  })
}

/** Increment the monthly paste counter. Call on paste creation. */
export async function incrementMonthlyPastes(userId: string) {
  const record = await getOrCreateUsage(userId)
  return db.usageRecord.update({
    where: { userId },
    data: { monthPasteCount: { increment: 1 }, totalPastes: { increment: 1 } },
  })
}

/** Check if the user can create another paste this month. */
export async function checkMonthlyLimit(userId: string | null, limits: PlanLimits): Promise<boolean> {
  if (!userId) return true // guests aren't monthly-limited (they have separate guest limits)
  const record = await getOrCreateUsage(userId)
  return record.monthPasteCount < limits.maxPastesPerMonth
}

/** Check if the user has enough storage for a new file of the given size. */
export async function checkStorageLimit(
  userId: string | null,
  additionalBytes: number,
  limits: PlanLimits
): Promise<boolean> {
  if (!userId) {
    // Guests: no persistent storage tracking, just check per-file size
    return additionalBytes <= limits.maxPasteSize
  }
  const record = await getOrCreateUsage(userId)
  const currentStorage = Number(record.storageBytes)
  return currentStorage + additionalBytes <= limits.maxStorageBytes
}

// ============================================================
// Expiry preset enforcement
// ============================================================

/** Check if an expiry preset is allowed by the plan. */
export function isExpiryAllowed(preset: string, limits: PlanLimits): boolean {
  if (preset === 'custom') return limits.allowCustomExpiry
  return limits.allowedExpiryPresets.includes(preset)
}

// ============================================================
// Subscription helpers
// ============================================================

/** Get all active subscriptions expiring within N days (for notifications). */
export async function getExpiringSubscriptions(days = 7) {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return db.subscription.findMany({
    where: {
      status: 'active',
      expiresAt: { gte: new Date(), lte: cutoff },
    },
    include: { user: true, plan: true },
    orderBy: { expiresAt: 'asc' },
  })
}

/** Mark expired subscriptions. */
export async function expireOverdueSubscriptions() {
  const result = await db.subscription.updateMany({
    where: {
      status: 'active',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  })
  return result.count
}
