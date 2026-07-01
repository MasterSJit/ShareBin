import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SESSION_COOKIE = 'ps_session'
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'pasteshare-dev-secret-change-me-please-this-is-for-dev-only-32+chars'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export type SessionPayload = {
  userId: string
  email: string
  role: string
  exp: number
}

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function base64UrlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
}

/** Create a signed session token (HMAC payload). */
export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }
  const body = base64UrlEncode(JSON.stringify(full))
  const sig = sign(body)
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = sign(body)
  // Constant-time-ish compare
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString('utf8')) as SessionPayload
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'exp'>) {
  const token = createSessionToken(payload)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
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
