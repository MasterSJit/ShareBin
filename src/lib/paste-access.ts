import { db } from '@/lib/db'
import { cacheGet, cacheSet, cacheDel, cacheDelPrefix, viewCounterIncr } from '@/lib/cache'
import { isExpired } from '@/lib/paste-utils'
import type { SafePaste } from '@/lib/types'

type PasteWithOwner = Awaited<ReturnType<typeof db.paste.findUnique>>

export function toSafePaste(
  p: NonNullable<PasteWithOwner>,
  opts: { includeContent?: boolean } = {}
): SafePaste {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    tags: p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    contentType: p.contentType as 'text' | 'file',
    language: p.language,
    visibility: p.visibility as 'public' | 'unlisted' | 'private',
    hasPassword: !!p.passwordHash,
    burnAfterRead: p.burnAfterRead,
    isBurned: p.isBurned,
    viewCount: p.viewCount,
    expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
    isExpired: isExpired(p.expiresAt),
    isFlagged: p.isFlagged,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    ownerId: p.ownerId,
    ownerName: p.owner?.displayName || p.owner?.email || null,
    originalFileName: p.originalFileName,
    mimeType: p.mimeType,
    fileSizeBytes: p.fileSizeBytes,
    textContent: opts.includeContent ? p.textContent : undefined,
  }
}

/**
 * Find a paste by id OR slug.
 */
export async function findPaste(idOrSlug: string) {
  const cacheKey = `paste:${idOrSlug}:meta`
  const cached = cacheGet<NonNullable<PasteWithOwner>>(cacheKey)
  if (cached) return cached
  const p = await db.paste.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      isDeleted: false,
    },
    include: { owner: true },
  })
  if (p) {
    const ttl = p.expiresAt
      ? Math.min(Math.max(p.expiresAt.getTime() - Date.now(), 5_000), 60 * 60 * 1000)
      : 60 * 60 * 1000
    cacheSet(cacheKey, p, ttl)
  }
  return p
}

export function invalidatePaste(idOrSlug: string) {
  cacheDel(`paste:${idOrSlug}:meta`)
  if (idOrSlug.length <= 12) {
    // probably a slug — also clear by-id via lookup is too expensive; just delPrefix user caches lazily
  }
}

export function invalidateUserPastes(userId: string) {
  cacheDelPrefix(`user:${userId}:pastes`)
}

export function recordView(pasteId: string) {
  viewCounterIncr(pasteId)
}

/**
 * Decide whether the current session is allowed to read a paste's content.
 * Returns one of:
 *  - 'ok'            → allowed
 *  - 'login_required' → must log in (private paste)
 *  - 'password_required' → must POST to /api/paste/unlock
 *  - 'gone'          → expired or burned
 *  - 'forbidden'     → not authorised
 */
export type AccessDecision =
  | 'ok'
  | 'login_required'
  | 'password_required'
  | 'gone'
  | 'forbidden'

export function decideAccess(
  paste: NonNullable<PasteWithOwner>,
  session: { userId: string; role: string } | null,
  unlockedPasswordPasteIds: Set<string>
): AccessDecision {
  // Expired or burned → 410 Gone
  if (isExpired(paste.expiresAt) || paste.isBurned) return 'gone'

  // Owner or admin → always allowed
  if (session && (session.userId === paste.ownerId || session.role === 'admin')) {
    return paste.passwordHash && !unlockedPasswordPasteIds.has(paste.id)
      ? 'password_required'
      : 'ok'
  }

  // Private — must be logged in AND (owner | access grant | admin)
  if (paste.visibility === 'private') {
    if (!session) return 'login_required'
    // access grant check should be done by caller (needs DB). For now treat as forbidden.
    return 'forbidden'
  }

  // Password protected (public/unlisted)
  if (paste.passwordHash && !unlockedPasswordPasteIds.has(paste.id)) {
    return 'password_required'
  }

  return 'ok'
}
