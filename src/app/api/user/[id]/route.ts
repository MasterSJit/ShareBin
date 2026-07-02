import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, forbidden, notFound } from '@/lib/api-response'
import type { SafeUser } from '@/lib/types'

// GET /api/user/[id] — fetch any user (public profile)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const u = await db.user.findUnique({ where: { id } })
  if (!u) return notFound('User not found')
  const safe: SafeUser = {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role as 'user' | 'admin',
    status: u.status as SafeUser['status'],
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    apiKey: u.apiKey,
    createdAt: u.createdAt.toISOString(),
  }
  return ok('User fetched', [safe])
}

// PATCH/DELETE by path param are admin-only and handled in /api/admin/user/[id].
export async function PATCH() {
  return forbidden('Use PATCH /api/admin/user/[id] for admin mutations')
}
export async function DELETE() {
  return forbidden('Use DELETE /api/admin/user/[id] for admin mutations')
}
