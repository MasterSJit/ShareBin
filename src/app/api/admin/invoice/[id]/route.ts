import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, unauthorized, forbidden, notFound } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// ============================================================
// Admin Invoice — single by id
// GET /api/admin/invoice/[id] — full invoice data + payment + user
// ============================================================

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

// GET /api/admin/invoice/[id] — get a single invoice by id (full data)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { id } = await ctx.params
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, displayName: true, role: true } },
      payment: {
        include: {
          plan: { select: { id: true, name: true, monthlyPrice: true } },
        },
      },
    },
  })
  if (!invoice) return notFound('Invoice not found')

  return ok('Invoice fetched', [
    {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        paymentId: invoice.paymentId,
        userId: invoice.userId,
        amount: invoice.amount,
        currency: invoice.currency,
        planName: invoice.planName,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd ? invoice.periodEnd.toISOString() : null,
        status: invoice.status,
        pdfKey: invoice.pdfKey,
        createdAt: invoice.createdAt.toISOString(),
      },
      user: invoice.user
        ? {
            id: invoice.user.id,
            email: invoice.user.email,
            displayName: invoice.user.displayName,
            role: invoice.user.role,
          }
        : null,
      payment: invoice.payment
        ? {
            id: invoice.payment.id,
            amount: invoice.payment.amount,
            currency: invoice.payment.currency,
            status: invoice.payment.status,
            method: invoice.payment.method,
            txnId: invoice.payment.txnId,
            invoiceNumber: invoice.payment.invoiceNumber,
            notes: invoice.payment.notes,
            subscriptionId: invoice.payment.subscriptionId,
            createdAt: invoice.payment.createdAt.toISOString(),
            plan: invoice.payment.plan
              ? {
                  id: invoice.payment.plan.id,
                  name: invoice.payment.plan.name,
                  monthlyPrice: invoice.payment.plan.monthlyPrice,
                }
              : null,
          }
        : null,
    },
  ])
}
