import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, forbidden, notFound } from '@/lib/api-response'
import { toPublicUser } from '@/lib/user-safe'

// GET /api/user/[id] — public profile (display name, join date, public paste count).
// Email, role, status and API key are never exposed here.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const u = await db.user.findUnique({
    where: { id },
    select: { id: true, displayName: true, createdAt: true, status: true },
  })
  if (!u || u.status === 'banned') return notFound('User not found')
  const publicPastes = await db.paste.count({
    where: {
      ownerId: id,
      visibility: 'public',
      isBurned: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })
  return ok('User fetched', [{ ...toPublicUser(u), publicPastes }])
}

// PATCH/DELETE by path param are admin-only and handled in /api/admin/user/[id].
export async function PATCH() {
  return forbidden('Use PATCH /api/admin/user/[id] for admin mutations')
}
export async function DELETE() {
  return forbidden('Use DELETE /api/admin/user/[id] for admin mutations')
}
