import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
} from '@/lib/api-response'
import { getSession, hashPassword, comparePassword, generateApiKey } from '@/lib/auth'
import { rateLimitHit, cacheDelPrefix } from '@/lib/cache'
import type { SafeUser } from '@/lib/types'

function toSafeUser(u: {
  id: string
  email: string
  displayName: string | null
  role: string
  status: string
  emailVerifiedAt: Date | null
  apiKey: string | null
  createdAt: Date
}, pasteCount?: number): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as 'user' | 'admin',
    status: u.status as SafeUser['status'],
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    apiKey: u.apiKey,
    createdAt: u.createdAt.toISOString(),
    pasteCount,
  }
}

// PUT /api/user — register a new user
export async function PUT(req: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const displayName = body.displayName?.trim() || null
  if (!email || !password) return badRequest('email and password are required')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest('Invalid email format')
  if (password.length < 8) return badRequest('Password must be at least 8 characters')

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (rateLimitHit(`register:${ip}`, 5, 60_000)) {
    return tooManyRequests('Too many registrations. Try again later.')
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return conflict('Email already registered')

  const hash = await hashPassword(password)
  const user = await db.user.create({
    data: {
      email,
      passwordHash: hash,
      displayName,
      role: 'user',
      status: 'active', // sandbox: auto-active (no SMTP)
      emailVerifiedAt: new Date(),
    },
  })

  await setSessionCookieSafe(user.id, user.email, user.role)
  return created('User registered successfully', [toSafeUser(user)])
}

// Helper to set session cookie without circular import
async function setSessionCookieSafe(userId: string, email: string, role: string) {
  const { setSessionCookie } = await import('@/lib/auth')
  await setSessionCookie({ userId, email, role })
}

// PATCH /api/user — update own profile (or {id} in body)
// Supports: displayName, password (current required), apiKey (regenerate)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: {
    id?: string
    displayName?: string
    currentPassword?: string
    newPassword?: string
    regenerateApiKey?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Only the user themselves can patch their own profile here.
  // (Admin mutations go through /api/admin/user.)
  const targetId = body.id && body.id !== session.userId ? body.id : session.userId
  if (targetId !== session.userId) return forbidden('Cannot edit another user')

  const user = await db.user.findUnique({ where: { id: targetId } })
  if (!user) return notFound('User not found')

  const patch: { displayName?: string | null; passwordHash?: string; apiKey?: string | null } = {}

  if (typeof body.displayName === 'string') {
    patch.displayName = body.displayName.trim().slice(0, 100) || null
  }

  if (body.newPassword) {
    if (!body.currentPassword) return badRequest('currentPassword is required to change password')
    if (body.newPassword.length < 8) return badRequest('New password too short')
    const okCur = await comparePassword(body.currentPassword, user.passwordHash)
    if (!okCur) return forbidden('Current password is incorrect')
    patch.passwordHash = await hashPassword(body.newPassword)
  }

  if (body.regenerateApiKey) {
    patch.apiKey = generateApiKey()
  }

  const updated = await db.user.update({ where: { id: targetId }, data: patch })
  cacheDelPrefix(`user:${targetId}`)
  return ok('Profile updated', [toSafeUser(updated)])
}

// DELETE /api/user — delete own account (currentPassword required)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: { id?: string; currentPassword?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    /* empty body allowed */
  }

  const targetId = body.id && body.id !== session.userId ? body.id : session.userId
  if (targetId !== session.userId) return forbidden('Cannot delete another user')

  const user = await db.user.findUnique({ where: { id: targetId } })
  if (!user) return notFound('User not found')

  if (!body.currentPassword) return badRequest('currentPassword is required')
  const okPw = await comparePassword(body.currentPassword, user.passwordHash)
  if (!okPw) return forbidden('Current password is incorrect')

  // Cascade: pastes get ownerId set null (per schema); access grants + audit logs remain.
  await db.user.delete({ where: { id: targetId } })
  cacheDelPrefix(`user:${targetId}`)

  const { clearSessionCookie } = await import('@/lib/auth')
  await clearSessionCookie()
  return ok('Account deleted', [])
}

// GET /api/user — own profile (no id) or list (admin only)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const list = searchParams.get('list')

  // /api/user?id=<userId> — fetch a specific user (public-ish profile)
  if (id) {
    const u = await db.user.findUnique({ where: { id } })
    if (!u) return notFound('User not found')
    return ok('User fetched', [toSafeUser(u)])
  }

  // /api/user?list=1 — admin only listing
  if (list) {
    if (session.role !== 'admin') return forbidden('Admin only')
    const users = await db.user.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    const ids = users.map((u) => u.id)
    const counts = await db.paste.groupBy({
      by: ['ownerId'],
      where: { ownerId: { in: ids }, isDeleted: false },
      _count: { _all: true },
    })
    const countMap = new Map(counts.map((c) => [c.ownerId, c._count._all]))
    return ok('Users fetched', users.map((u) => toSafeUser(u, countMap.get(u.id) ?? 0)))
  }

  // default — own profile
  const me = await db.user.findUnique({ where: { id: session.userId } })
  if (!me) return notFound('User not found')
  return ok('Current user', [toSafeUser(me)])
}
