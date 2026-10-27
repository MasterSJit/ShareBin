import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { cacheGet, cacheSet, cacheDel, cacheDelPrefix, rateLimitHit } from '@/lib/cache'
import { isExpired } from '@/lib/paste-utils'
import { hmac, safeEqual, comparePassword, clientIp, type SessionPayload } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { unauthorized, forbidden, gone, tooManyRequests } from '@/lib/api-response'
import type { SafePaste } from '@/lib/types'

export type PasteRecord = Prisma.PasteGetPayload<{ include: { owner: true } }>

const PREVIEW_CHARS = 240

export function toSafePaste(
  p: PasteRecord,
  opts: { includeContent?: boolean; includePreview?: boolean } = {}
): SafePaste {
  // A short preview is only safe when reading the paste needs nothing extra.
  const canPreview =
    opts.includePreview &&
    p.contentType === 'text' &&
    !p.passwordHash &&
    !p.burnAfterRead &&
    !!p.textContent
  const text = p.textContent ?? ''
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
    // Never fall back to the owner's email — that would publish it.
    ownerName: p.owner ? p.owner.displayName || 'Member' : null,
    originalFileName: p.originalFileName,
    mimeType: p.mimeType,
    fileSizeBytes: p.fileSizeBytes,
    sizeBytes: p.contentType === 'text' ? Buffer.byteLength(text, 'utf8') : p.fileSizeBytes ?? 0,
    lineCount: p.contentType === 'text' ? (text ? text.split('\n').length : 0) : undefined,
    textContent: opts.includeContent ? p.textContent : undefined,
    preview: canPreview
      ? text.slice(0, PREVIEW_CHARS) + (text.length > PREVIEW_CHARS ? '…' : '')
      : undefined,
  }
}

// Metadata cache. Kept short because rows include the full text body.
const META_TTL_MS = 30_000

/** Find a paste by id OR slug. */
export async function findPaste(idOrSlug: string): Promise<PasteRecord | null> {
  const cacheKey = `paste:${idOrSlug}:meta`
  const cached = cacheGet<PasteRecord>(cacheKey)
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
      ? Math.min(Math.max(p.expiresAt.getTime() - Date.now(), 1_000), META_TTL_MS)
      : META_TTL_MS
    cacheSet(cacheKey, p, ttl)
  }
  return p
}

export function invalidatePaste(idOrSlug: string) {
  cacheDel(`paste:${idOrSlug}:meta`)
}

/** Drop both cache keys (id + slug) for a paste. */
export function invalidatePasteRecord(p: { id: string; slug: string; ownerId?: string | null }) {
  invalidatePaste(p.id)
  invalidatePaste(p.slug)
  if (p.ownerId) invalidateUserPastes(p.ownerId)
}

export function invalidateUserPastes(userId: string) {
  cacheDelPrefix(`user:${userId}:pastes`)
}

// ---------------------------------------------------------------------------
// Unlock tokens (password-protected pastes)
//
// POST /api/paste/unlock verifies the password and returns a short-lived token
// bound to the paste id AND its current password hash (changing the password
// revokes outstanding tokens). The token is also set as an httpOnly cookie so
// <img>/<video>/download links work without custom headers. Clients may send
// it as `x-unlock-token`, `?token=` or the cookie; one-shot callers can send
// the password itself in `x-paste-password`.
// ---------------------------------------------------------------------------

export const UNLOCK_TTL_SECONDS = 60 * 60 // 1 hour

export function unlockCookieName(pasteId: string) {
  return `ps_ul_${pasteId}`
}

export function createUnlockToken(paste: { id: string; passwordHash: string | null }): string {
  const exp = Date.now() + UNLOCK_TTL_SECONDS * 1000
  const sig = hmac(`${paste.id}:${exp}:${paste.passwordHash ?? ''}`, 'unlock')
  return `${exp}.${sig}`
}

export function verifyUnlockToken(
  paste: { id: string; passwordHash: string | null },
  token: string | null | undefined,
): boolean {
  if (!token || !paste.passwordHash) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = Number(token.slice(0, dot))
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = hmac(`${paste.id}:${exp}:${paste.passwordHash}`, 'unlock')
  return safeEqual(token.slice(dot + 1), expected)
}

/** Rate-limit password guesses per IP + paste. Returns true when blocked. */
export function passwordAttemptBlocked(req: NextRequest, pasteId: string): boolean {
  return rateLimitHit(`unlock:${clientIp(req.headers)}:${pasteId}`, 10, 60_000)
}

async function isPasteUnlocked(req: NextRequest, paste: PasteRecord): Promise<boolean> {
  if (!paste.passwordHash) return true
  const candidates: (string | undefined | null)[] = [
    req.cookies.get(unlockCookieName(paste.id))?.value,
    new URL(req.url).searchParams.get('token'),
    ...(req.headers.get('x-unlock-token') || '').split(',').map((s) => s.trim()),
  ]
  if (candidates.some((t) => verifyUnlockToken(paste, t))) return true

  // Callers rate-limit this header before we get here (see checkPasteAccess).
  const direct = req.headers.get('x-paste-password')
  if (direct) return comparePassword(direct, paste.passwordHash)
  return false
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

/** Can this caller moderate any paste (admin role or `admin:content`)? */
export async function canModerate(session: SessionPayload | null): Promise<boolean> {
  if (!session) return false
  if (session.role === 'admin') return true
  return hasPermission(session.userId, 'admin:content')
}

export type AccessResult =
  | { status: 'ok'; isOwner: boolean; isModerator: boolean }
  | { status: 'password_required' }
  | { status: 'denied'; response: Response }

/**
 * Single source of truth for "may this caller read this paste's content?".
 * Order: gone (expired/burned) → private visibility → password.
 * Owners and moderators skip the password gate. Expired pastes are deleted.
 */
export async function checkPasteAccess(
  req: NextRequest,
  paste: PasteRecord,
  session: SessionPayload | null,
): Promise<AccessResult> {
  if (isExpired(paste.expiresAt)) {
    const { hardDeletePaste } = await import('@/lib/cleanup')
    await hardDeletePaste(paste.id, 'expired').catch(() => {})
    return { status: 'denied', response: gone('Paste has expired and been permanently deleted') }
  }
  if (paste.isBurned) {
    return { status: 'denied', response: gone('Paste was burned after reading and is no longer available') }
  }

  const isOwner = !!session && !!paste.ownerId && session.userId === paste.ownerId
  const isModerator = !isOwner && (await canModerate(session))

  if (paste.visibility === 'private' && !isOwner && !isModerator) {
    if (!session) {
      return { status: 'denied', response: unauthorized('Login required to view this private paste') }
    }
    const grant = await db.pasteAccessGrant.findUnique({
      where: { pasteId_userId: { pasteId: paste.id, userId: session.userId } },
    })
    if (!grant) {
      return { status: 'denied', response: forbidden('You do not have access to this private paste') }
    }
  }

  if (paste.passwordHash && !isOwner && !isModerator) {
    if (req.headers.get('x-paste-password') && passwordAttemptBlocked(req, paste.id)) {
      return { status: 'denied', response: tooManyRequests('Too many password attempts. Try again in a minute.') }
    }
    if (!(await isPasteUnlocked(req, paste))) return { status: 'password_required' }
  }

  return { status: 'ok', isOwner, isModerator }
}

/**
 * Atomically mark a burn-after-read paste as burned. Returns false when
 * another request already burned it (so only one reader ever gets content).
 */
export async function claimBurn(paste: PasteRecord): Promise<boolean> {
  const res = await db.paste.updateMany({
    where: { id: paste.id, isBurned: false },
    data: { isBurned: true, viewCount: { increment: 1 } },
  })
  invalidatePasteRecord(paste)
  return res.count === 1
}

/** Hard-delete a burned paste shortly after the response has been produced. */
export function scheduleBurnDelete(pasteId: string) {
  setTimeout(async () => {
    try {
      const { hardDeletePaste } = await import('@/lib/cleanup')
      await hardDeletePaste(pasteId, 'burned')
    } catch {
      /* the cleanup cron will retry */
    }
  }, 1_000)
}

/** Increment the view counter and return the new value. */
export async function recordView(paste: PasteRecord): Promise<number> {
  const updated = await db.paste.update({
    where: { id: paste.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  })
  // Keep the cached copy roughly in sync instead of re-reading the full row.
  paste.viewCount = updated.viewCount
  return updated.viewCount
}
