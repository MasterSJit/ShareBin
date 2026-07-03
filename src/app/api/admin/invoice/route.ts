import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// ============================================================
// Admin Invoices list — /api/admin/invoice
// ============================================================

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

type InvoiceRow = {
  id: string
  number: string
  paymentId: string
  userId: string
  user: { email: string; displayName: string | null } | null
  amount: number
  currency: string
  planName: string
  periodStart: string
  periodEnd: string | null
  status: string
  createdAt: string
}

function invoiceToSafe(inv: {
  id: string
  number: string
  paymentId: string
  userId: string
  amount: number
  currency: string
  planName: string
  periodStart: Date
  periodEnd: Date | null
  status: string
  createdAt: Date
  user: { id: string; email: string; displayName: string | null } | null
}): InvoiceRow {
  return {
    id: inv.id,
    number: inv.number,
    paymentId: inv.paymentId,
    userId: inv.userId,
    user: inv.user ? { email: inv.user.email, displayName: inv.user.displayName } : null,
    amount: inv.amount,
    currency: inv.currency,
    planName: inv.planName,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd ? inv.periodEnd.toISOString() : null,
    status: inv.status,
    createdAt: inv.createdAt.toISOString(),
  }
}

// GET /api/admin/invoice — list all invoices (admin only), supports ?userId= filter
export async function GET(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || undefined

  const where: Record<string, unknown> = {}
  if (userId) where.userId = userId

  const invoices = await db.invoice.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok('Invoices fetched', invoices.map(invoiceToSafe))
}
