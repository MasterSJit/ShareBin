import { cookies, headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { cacheGet, cacheSet } from '@/lib/cache'

const SESSION_COOKIE = 'ps_session'

const DEV_FALLBACK_SECRET = 'pasteshare-dev-secret-change-me-please-this-is-for-dev-only-32+chars'
const SESSION_SECRET = process.env.SESSION_SECRET || DEV_FALLBACK_SECRET

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
) {
  console.warn(
    '[auth] SESSION_SECRET is missing or shorter than 32 characters. ' +
      'Set a long random value (openssl rand -hex 32) before going to production.',
  )
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

/** Statuses that are allowed to hold a session / use an API key. */
const BLOCKED_STATUSES = new Set(['banned', 'suspended'])

export type SessionPayload = {
  userId: string
  email: string
  role: string
  exp: number
  /** User.sessionVersion at the time the token was issued. */
  v?: number
  /** How the caller authenticated. Only set on values returned by getSession(). */
  via?: 'session' | 'api_key'
}

type TokenInput = { userId: string; email: string; role: string; v?: number }

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function base64UrlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

/**
 * HMAC-SHA256 with the session secret. `purpose` domain-separates token kinds;
 * session tokens keep the original unprefixed format so existing logins stay valid.
 */
export function hmac(data: string, purpose = 'session'): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(purpose === 'session' ? data : `${purpose}:${data}`)
    .digest('base64url')
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** Create a signed session token (HMAC payload). */
export function createSessionToken(payload: TokenInput): string {
  const full: SessionPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    v: payload.v ?? 0,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  }
  const body = base64UrlEncode(JSON.stringify(full))
  return `${body}.${hmac(body)}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!safeEqual(sig, hmac(body))) return null
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString('utf8')) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function setSessionCookie(payload: TokenInput) {
  const token = createSessionToken(payload)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

type AuthUser = {
  id: string
  email: string
  role: string
  status: string
  sessionVersion: number
}

/**
 * Load the fields needed to authorise a request. Cached for a few seconds so
 * a page that fires several API calls doesn't hit the DB for each one. Admin
 * mutations clear `user:<id>*` keys, so bans/role changes apply immediately.
 */
async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const key = `user:${userId}:auth`
  const cached = cacheGet<AuthUser | 'missing'>(key)
  if (cached === 'missing') return null
  if (cached) return cached
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true, sessionVersion: true },
  })
  cacheSet(key, user ?? 'missing', 5_000)
  return user
}

/** Pull an API key from `x-api-key` or `Authorization: Bearer ps_…`. */
export function extractApiKey(h: Headers): string | null {
  const direct = h.get('x-api-key')
  if (direct) return direct.trim()
  const auth = h.get('authorization')
  if (auth && /^bearer\s+ps_/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim()
  return null
}

async function getApiKeySession(apiKey: string): Promise<SessionPayload | null> {
  if (apiKey.length < 8 || apiKey.length > 128) return null
  // Lazy import avoids a cycle (paste-utils -> db, auth is imported widely).
  const { getSetting } = await import('@/lib/paste-utils')
  const enabled = await getSetting<boolean>('apiEnabled')
  if (enabled === false) return null

  const user = await db.user.findUnique({
    where: { apiKey },
    select: { id: true, email: true, role: true, status: true },
  })
  if (!user || BLOCKED_STATUSES.has(user.status)) return null
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 60_000,
    via: 'api_key',
  }
}

/**
 * Resolve the caller from the session cookie, falling back to an API key
 * (`x-api-key: ps_…` or `Authorization: Bearer ps_…`).
 *
 * The session token is re-validated against the database on every call so
 * that banned/suspended users, deleted users, role changes and password
 * resets (which bump `sessionVersion`) take effect immediately rather than
 * when the 7-day cookie expires. The returned `role` is always the current
 * DB role, never the one baked into the token.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (payload) {
    const user = await loadAuthUser(payload.userId)
    if (
      user &&
      !BLOCKED_STATUSES.has(user.status) &&
      (payload.v ?? 0) === user.sessionVersion
    ) {
      return { ...payload, email: user.email, role: user.role, via: 'session' }
    }
  }

  const apiKey = extractApiKey(await headers())
  if (apiKey) return getApiKeySession(apiKey)
  return null
}

/**
 * Invalidate every existing session for a user (password change/reset, ban).
 * Returns the new version so the caller can re-issue the current session.
 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const updated = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  })
  const { cacheDelPrefix } = await import('@/lib/cache')
  cacheDelPrefix(`user:${userId}`)
  return updated.sessionVersion
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function generateApiKey(): string {
  return 'ps_' + crypto.randomBytes(24).toString('hex')
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

/**
 * Best-effort client IP. Only the first hop of X-Forwarded-For is used; put
 * the app behind a proxy that overwrites the header (Caddy/nginx do) so it
 * can't be spoofed.
 */
export function clientIp(h: Headers): string {
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim() || 'unknown'
  return h.get('x-real-ip') || 'unknown'
}
