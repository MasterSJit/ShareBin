import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { parseJsonBody } from '@/lib/parse-body'
import { auditLog } from '@/lib/paste-utils'

// ============================================================
// Admin Payments CRUD — /api/admin/payment
// ============================================================

async function requirePerm(perm: string) {
  const session = await getSession()
  if (!session) return { error: unauthorized('Authentication required') as Response, session: null }
  const okp = await hasPermission(session.userId, perm)
  if (!okp && session.role !== 'admin') return { error: forbidden('Insufficient permissions') as Response, session: null }
  return { error: null, session }
}

type PaymentRow = {
  id: string
  userId: string
  user: { email: string; displayName: string | null } | null
  planId: string
  plan: { name: string; monthlyPrice: number } | null
  amount: number
  currency: string
  status: string
  method: string
  txnId: string | null
  invoiceNumber: string | null
  notes: string | null
  createdAt: string
}

function paymentToSafe(p: {
  id: string
  userId: string
  planId: string
  amount: number
  currency: string
  status: string
  method: string
  txnId: string | null
  invoiceNumber: string | null
  notes: string | null
  createdAt: Date
  user: { id: string; email: string; displayName: string | null } | null
  plan: { id: string; name: string; monthlyPrice: number } | null
}): PaymentRow {
  return {
    id: p.id,
    userId: p.userId,
    user: p.user ? { email: p.user.email, displayName: p.user.displayName } : null,
    planId: p.planId,
    plan: p.plan ? { name: p.plan.name, monthlyPrice: p.plan.monthlyPrice } : null,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method,
    txnId: p.txnId,
    invoiceNumber: p.invoiceNumber,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  }
}

const VALID_STATUSES = ['pending', 'completed', 'failed', 'refunded']
const VALID_METHODS = ['manual', 'stripe', 'paypal', 'razorpay']

/**
 * Generate a unique invoice number in the form INV-YYYYMMDD-XXXX.
 * XXXX is a random 4-digit suffix that we re-roll on collision.
 */
async function generateInvoiceNumber(): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  for (let i = 0; i < 8; i++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000))
    const number = `INV-${ymd}-${suffix}`
    const existing = await db.payment.findUnique({ where: { invoiceNumber: number }, select: { id: true } })
    if (!existing) {
      const invExisting = await db.invoice.findUnique({ where: { number }, select: { id: true } })
      if (!invExisting) return number
    }
  }
  // Extremely unlikely fallback
  return `INV-${ymd}-${Date.now().toString().slice(-6)}`
}

// GET /api/admin/payment — list all payments (admin only)
export async function GET(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined

  const where: Record<string, unknown> = {}
  if (status && VALID_STATUSES.includes(status)) where.status = status

  const payments = await db.payment.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      plan: { select: { id: true, name: true, monthlyPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok('Payments fetched', payments.map(paymentToSafe))
}

// PUT /api/admin/payment — create a payment record (admin manually records a payment)
export async function PUT(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je1 } = await parseJsonBody<{
    userId?: string
    planId?: string
    amount?: number
    method?: string
    txnId?: string
    notes?: string
    status?: string
  }>(req)
  if (je1 || !body) return badRequest(je1 || 'Invalid JSON')
  if (!body.userId) return badRequest('userId is required')
  if (!body.planId) return badRequest('planId is required')
  if (body.amount === undefined || typeof body.amount !== 'number' || isNaN(body.amount)) {
    return badRequest('amount is required (number)')
  }

  const user = await db.user.findUnique({ where: { id: body.userId }, select: { id: true, email: true, displayName: true } })
  if (!user) return notFound('User not found')
  const plan = await db.plan.findUnique({ where: { id: body.planId } })
  if (!plan) return notFound('Plan not found')

  const status = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'completed'
  const method = body.method && VALID_METHODS.includes(body.method) ? body.method : 'manual'

  // Uniqueness check on txnId if provided
  if (body.txnId) {
    const dupTxn = await db.payment.findUnique({ where: { txnId: body.txnId }, select: { id: true } })
    if (dupTxn) return badRequest('txnId already exists')
  }

  const invoiceNumber = await generateInvoiceNumber()
  const now = new Date()
  // Default period: 30 days from now (null = lifetime for free / no-expiry plans)
  const periodEnd = plan.monthlyPrice > 0 ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null

  // Run payment + invoice + subscription in a transaction
  try {
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: body.userId!,
          planId: body.planId!,
          amount: body.amount!,
          currency: 'USD',
          status,
          method,
          txnId: body.txnId || null,
          invoiceNumber,
          notes: body.notes || null,
        },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          plan: { select: { id: true, name: true, monthlyPrice: true } },
        },
      })

      // Create the invoice linked to this payment
      await tx.invoice.create({
        data: {
          paymentId: payment.id,
          userId: body.userId!,
          number: invoiceNumber,
          amount: body.amount!,
          currency: 'USD',
          planName: plan.name,
          periodStart: now,
          periodEnd,
          status: status === 'completed' ? 'paid' : 'issued',
        },
      })

      // Assign/extend the user's subscription (only for completed payments)
      let subscriptionId: string | null = null
      if (status === 'completed') {
        // Cancel existing active subs for the user
        await tx.subscription.updateMany({
          where: { userId: body.userId!, status: 'active' },
          data: { status: 'cancelled' },
        })
        const sub = await tx.subscription.create({
          data: {
            userId: body.userId!,
            planId: body.planId!,
            status: 'active',
            startedAt: now,
            expiresAt: periodEnd,
          },
        })
        subscriptionId = sub.id
        // Link subscription back to payment
        await tx.payment.update({ where: { id: payment.id }, data: { subscriptionId } })
      }

      return { payment, subscriptionId }
    })

    await auditLog(session.userId, 'create_payment', 'payment', result.payment.id, {
      userId: body.userId,
      planId: body.planId,
      planName: plan.name,
      amount: body.amount,
      currency: 'USD',
      status,
      method,
      invoiceNumber,
      subscriptionId: result.subscriptionId,
    })

    return created('Payment recorded', [paymentToSafe(result.payment)])
  } catch (e) {
    return serverError('Failed to record payment: ' + (e as Error).message)
  }
}

// PATCH /api/admin/payment — update payment status (id in body)
export async function PATCH(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je2 } = await parseJsonBody<{
    id?: string
    status?: string
    txnId?: string
    notes?: string
  }>(req)
  if (je2 || !body) return badRequest(je2 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const payment = await db.payment.findUnique({ where: { id: body.id } })
  if (!payment) return notFound('Payment not found')

  const patch: Record<string, unknown> = {}
  if (body.status && VALID_STATUSES.includes(body.status)) patch.status = body.status
  if (body.txnId !== undefined) {
    if (body.txnId && body.txnId !== payment.txnId) {
      const dup = await db.payment.findUnique({ where: { txnId: body.txnId }, select: { id: true } })
      if (dup && dup.id !== payment.id) return badRequest('txnId already exists')
    }
    patch.txnId = body.txnId || null
  }
  if (body.notes !== undefined) patch.notes = body.notes || null

  if (Object.keys(patch).length === 0) return badRequest('No valid fields to update')

  // If status changed to completed, mark the linked invoice as paid
  const updated = await db.payment.update({
    where: { id: body.id },
    data: patch,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      plan: { select: { id: true, name: true, monthlyPrice: true } },
    },
  })

  if (body.status === 'completed') {
    await db.invoice.updateMany({
      where: { paymentId: payment.id },
      data: { status: 'paid' },
    })
  } else if (body.status === 'refunded' || body.status === 'failed') {
    await db.invoice.updateMany({
      where: { paymentId: payment.id },
      data: { status: body.status === 'refunded' ? 'void' : 'issued' },
    })
  }

  await auditLog(session.userId, 'update_payment', 'payment', payment.id, { after: patch })
  return ok('Payment updated', [paymentToSafe(updated)])
}

// DELETE /api/admin/payment — delete a payment (id in body)
export async function DELETE(req: NextRequest) {
  const { error, session } = await requirePerm('admin:subscriptions')
  if (error || !session) return error

  const { data: body, error: je3 } = await parseJsonBody<{ id?: string }>(req)
  if (je3 || !body) return badRequest(je3 || 'Invalid JSON')
  if (!body.id) return badRequest('id is required')

  const payment = await db.payment.findUnique({ where: { id: body.id } })
  if (!payment) return notFound('Payment not found')

  // The Invoice table cascades on payment delete (onDelete: Cascade in schema)
  await db.payment.delete({ where: { id: body.id } })
  await auditLog(session.userId, 'delete_payment', 'payment', body.id, {
    userId: payment.userId,
    amount: payment.amount,
    invoiceNumber: payment.invoiceNumber,
  })
  return ok('Payment deleted', [])
}
