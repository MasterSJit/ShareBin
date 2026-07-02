import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import { isExpired } from '@/lib/paste-utils'
import { invalidatePaste } from '@/lib/paste-access'

/**
 * Hard-delete a single paste: remove the storage file (if file type),
 * delete the DB record, and write an audit-log entry.
 * Returns true if a paste was deleted.
 */
export async function hardDeletePaste(
  pasteId: string,
  reason: 'expired' | 'burned' | 'admin',
  adminId?: string
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

  // Delete access grants
  await db.pasteAccessGrant.deleteMany({ where: { pasteId } })

  // Delete the paste record
  await db.paste.delete({ where: { id: pasteId } })

  // Invalidate caches
  invalidatePaste(paste.slug)
  invalidatePaste(paste.id)
  if (paste.ownerId) {
    const { invalidateUserPastes } = await import('@/lib/paste-access')
    invalidateUserPastes(paste.ownerId)
  }

  // Write an audit log entry
  if (reason === 'admin' && adminId) {
    await db.auditLog.create({
      data: {
        adminId,
        action: 'delete_paste',
        targetType: 'paste',
        targetId: pasteId,
        metadata: JSON.stringify({
          slug: paste.slug,
          title: paste.title,
          contentType: paste.contentType,
          reason,
        }),
      },
    })
  } else {
    // System-initiated deletion (expired/burned) — log with a system admin ID.
    // Find any admin user to attribute the log to.
    const admin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
    if (admin) {
      await db.auditLog.create({
        data: {
          adminId: admin.id,
          action: `auto_delete_${reason}`,
          targetType: 'paste',
          targetId: pasteId,
          metadata: JSON.stringify({
            slug: paste.slug,
            title: paste.title,
            contentType: paste.contentType,
            language: paste.language,
            viewCount: paste.viewCount,
            reason,
            expiredAt: paste.expiresAt ? paste.expiresAt.toISOString() : null,
            burned: paste.isBurned,
          }),
        },
      })
    }
  }

  return true
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
      isDeleted: false,
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

/**
 * Run the full cleanup: expired + burned pastes.
 * Returns a summary of what was cleaned.
 */
export async function runCleanup(): Promise<{ expired: number; burned: number }> {
  const expired = await cleanupExpiredPastes()
  const burned = await cleanupBurnedPastes()
  return { expired, burned }
}
