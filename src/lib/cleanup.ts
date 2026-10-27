import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import { auditLog } from '@/lib/paste-utils'
import { invalidatePasteRecord } from '@/lib/paste-access'

export type DeleteReason = 'expired' | 'burned' | 'admin' | 'owner'

/**
 * Hard-delete a single paste: remove the storage file (if file type),
 * delete the DB record, and write an audit-log entry.
 * Returns true if a paste was deleted.
 *
 * `actorId` is the user who triggered the delete; system deletions
 * (expired/burned) are logged with a null actor.
 */
export async function hardDeletePaste(
  pasteId: string,
  reason: DeleteReason,
  actorId?: string
): Promise<boolean> {
  const paste = await db.paste.findUnique({ where: { id: pasteId } })
  if (!paste) return false

  // Delete the storage file (if it's a file paste)
  if (paste.contentType === 'file' && paste.storageKey) {
    try {
      await getStorage().delete(paste.storageKey)
    } catch {
      // file may already be gone — ignore
    }
  }

  // Access grants cascade, but deleteMany keeps this explicit for older DBs.
  await db.pasteAccessGrant.deleteMany({ where: { pasteId } })
  // deleteMany avoids a P2025 throw when two requests race to delete.
  const { count } = await db.paste.deleteMany({ where: { id: pasteId } })
  invalidatePasteRecord(paste)
  if (count === 0) return false

  if (paste.ownerId) {
    const { recomputeUsage } = await import('@/lib/rbac')
    await recomputeUsage(paste.ownerId).catch(() => {})
  }

  const isUserAction = reason === 'admin' || reason === 'owner'
  await auditLog(
    isUserAction ? actorId ?? null : null,
    isUserAction ? (reason === 'owner' ? 'delete_own_paste' : 'delete_paste') : `auto_delete_${reason}`,
    'paste',
    pasteId,
    {
      slug: paste.slug,
      title: paste.title,
      contentType: paste.contentType,
      language: paste.language,
      viewCount: paste.viewCount,
      reason,
      expiredAt: paste.expiresAt ? paste.expiresAt.toISOString() : null,
      burned: paste.isBurned,
    },
  ).catch(() => {})

  return true
}

/** Hard-delete every paste (and stored file) owned by a user. */
export async function hardDeleteUserPastes(userId: string, actorId?: string): Promise<number> {
  const pastes = await db.paste.findMany({ where: { ownerId: userId }, select: { id: true } })
  let count = 0
  for (const p of pastes) {
    if (await hardDeletePaste(p.id, actorId && actorId !== userId ? 'admin' : 'owner', actorId ?? userId)) {
      count++
    }
  }
  return count
}

/**
 * Find and hard-delete all expired pastes.
 * Called opportunistically on paste access + via the cron endpoint.
 * Returns the number of pastes deleted.
 */
export async function cleanupExpiredPastes(): Promise<number> {
  const now = new Date()
  const expired = await db.paste.findMany({
    where: {
      isDeleted: false,
      expiresAt: { lt: now, not: null },
    },
    select: { id: true },
    take: 100,
  })

  let count = 0
  for (const p of expired) {
    const deleted = await hardDeletePaste(p.id, 'expired')
    if (deleted) count++
  }
  return count
}

/**
 * Find and hard-delete all burned pastes older than `graceMinutes`
 * (default 2 minutes — gives the GET response time to complete).
 * Returns the number of pastes deleted.
 */
export async function cleanupBurnedPastes(graceMinutes = 2): Promise<number> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000)
  const burned = await db.paste.findMany({
    where: {
      isBurned: true,
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 100,
  })

  let count = 0
  for (const p of burned) {
    const deleted = await hardDeletePaste(p.id, 'burned')
    if (deleted) count++
  }
  return count
}

/** Remove expired password-reset tokens. */
export async function cleanupResetTokens(): Promise<number> {
  const { count } = await db.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return count
}

let lastOpportunisticRun = 0

/**
 * Run the full cleanup: expired + burned pastes + stale reset tokens.
 * Returns a summary of what was cleaned.
 */
export async function runCleanup(): Promise<{ expired: number; burned: number; resetTokens: number }> {
  lastOpportunisticRun = Date.now()
  const expired = await cleanupExpiredPastes()
  const burned = await cleanupBurnedPastes()
  const resetTokens = await cleanupResetTokens()
  return { expired, burned, resetTokens }
}

/**
 * Fire-and-forget cleanup from request handlers, throttled to once a minute
 * so busy listing endpoints don't scan the table on every request.
 */
export function maybeRunCleanup() {
  if (Date.now() - lastOpportunisticRun < 60_000) return
  runCleanup().catch(() => {})
}
