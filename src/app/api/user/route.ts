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
} from '@/lib/api-response'
import {
  getSession,
  hashPassword,
  comparePassword,
  generateApiKey,
  setSessionCookie,
  clearSessionCookie,
  bumpSessionVersion,
  clientIp,
} from '@/lib/auth'
import { rateLimitHit, cacheDelPrefix } from '@/lib/cache'
import { getSetting } from '@/lib/paste-utils'
import { hardDeleteUserPastes } from '@/lib/cleanup'
import { toSafeUser, toPublicUser } from '@/lib/user-safe'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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
  const displayName = body.displayName?.trim().slice(0, 100) || null
  if (!email || !password) return badRequest('email and password are required')
  if (email.length > 254 || !EMAIL_RE.test(email)) return badRequest('Invalid email format')
  if (password.length < 8) return badRequest('Password must be at least 8 characters')
  if (password.length > 256) return badRequest('Password is too long')

  if ((await getSetting<boolean>('registrationEnabled')) === false) {
    return forbidden('Registration is currently closed')
  }

  if (rateLimitHit(`register:${clientIp(req.headers)}`, 5, 60_000)) {
    return tooManyRequests('Too many registrations. Try again later.')
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return conflict('Email already registered')

  // Link the RBAC "user" role when it exists so permission checks work.
  const userRole = await db.role.findUnique({ where: { name: 'user' }, select: { id: true } })

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      displayName,
      role: 'user',
      roleId: userRole?.id ?? null,
      status: 'active', // sandbox: auto-active (no SMTP)
      emailVerifiedAt: new Date(),
    },
  })

  await setSessionCookie({ userId: user.id, email: user.email, role: user.role, v: user.sessionVersion })
  return created('User registered successfully', [toSafeUser(user)])
}

// PATCH /api/user — update own profile
// Supports: displayName, password (current required), apiKey (regenerate / revoke)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: {
    id?: string
    displayName?: string
    currentPassword?: string
    newPassword?: string
    regenerateApiKey?: boolean
    revokeApiKey?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  // Only the user themselves can patch their own profile here.
  // (Admin mutations go through /api/admin/user.)
  if (body.id && body.id !== session.userId) return forbidden('Cannot edit another user')

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return notFound('User not found')

  const patch: { displayName?: string | null; passwordHash?: string; apiKey?: string | null } = {}

  if (typeof body.displayName === 'string') {
    patch.displayName = body.displayName.trim().slice(0, 100) || null
  }

  let passwordChanged = false
  if (body.newPassword) {
    if (!body.currentPassword) return badRequest('currentPassword is required to change password')
    if (body.newPassword.length < 8) return badRequest('New password must be at least 8 characters')
    if (body.newPassword.length > 256) return badRequest('New password is too long')
    const okCur = await comparePassword(body.currentPassword, user.passwordHash)
    if (!okCur) return forbidden('Current password is incorrect')
    patch.passwordHash = await hashPassword(body.newPassword)
    passwordChanged = true
  }

  if (body.regenerateApiKey) patch.apiKey = generateApiKey()
  else if (body.revokeApiKey) patch.apiKey = null

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')

  let updated = await db.user.update({ where: { id: user.id }, data: patch })
  cacheDelPrefix(`user:${user.id}`)

  if (passwordChanged) {
    // Sign out every other device, then re-issue this browser's session.
    const v = await bumpSessionVersion(user.id)
    updated = { ...updated, sessionVersion: v }
    if (session.via === 'session') {
      await setSessionCookie({ userId: updated.id, email: updated.email, role: updated.role, v })
    }
  }
  return ok('Profile updated', [toSafeUser(updated)])
}

// DELETE /api/user — delete own account and all its pastes (currentPassword required)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  let body: { id?: string; currentPassword?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body allowed */
  }

  if (body.id && body.id !== session.userId) return forbidden('Cannot delete another user')

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return notFound('User not found')

  if (!body.currentPassword) return badRequest('currentPassword is required')
  const okPw = await comparePassword(body.currentPassword, user.passwordHash)
  if (!okPw) return forbidden('Current password is incorrect')

  if (user.role === 'admin') {
    const otherAdmins = await db.user.count({ where: { role: 'admin', id: { not: user.id } } })
    if (otherAdmins === 0) return badRequest('You are the last admin — promote someone else before deleting this account')
  }

  // Pastes would otherwise be orphaned (ownerId → null) and look like guest
  // pastes; the UI promises they are deleted, so delete them and their files.
  const deletedPastes = await hardDeleteUserPastes(user.id, user.id)
  await db.user.delete({ where: { id: user.id } })
  cacheDelPrefix(`user:${user.id}`)

  await clearSessionCookie()
  return ok('Account deleted', [{ deletedPastes }])
}

// GET /api/user — own profile; ?id=<userId> → public profile; ?list=1 → admin listing
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized('Authentication required')

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const list = searchParams.get('list')

  if (id && id !== session.userId) {
    const u = await db.user.findUnique({ where: { id } })
    if (!u) return notFound('User not found')
    // Admins see the full record; everyone else gets the public profile only
    // (this used to return any user's email and API key).
    return ok('User fetched', [session.role === 'admin' ? toSafeUser(u) : toPublicUser(u)])
  }

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

  const me = await db.user.findUnique({ where: { id: session.userId } })
  if (!me) return notFound('User not found')
  return ok('Current user', [toSafeUser(me)])
}
