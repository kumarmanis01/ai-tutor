import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createRazorpayOrder } from '@/lib/payments/razorpay'

export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    const planMonthsRaw = typeof body?.planMonths === 'number' ? body.planMonths : 1
    const planMonths = Math.max(1, Math.min(Math.floor(planMonthsRaw || 1), 12))

    const order = await createRazorpayOrder(userId, planMonths)
    if (!order) {
      const res = NextResponse.json({ error: 'Could not create payment order' }, { status: 500 })
      logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
      return res
    }

    await prisma.paymentOrder.create({
      data: {
        studentId: userId,
        razorpayOrderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        status: 'created',
        planMonths,
      },
    })

    const res = NextResponse.json(
      {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID ?? '',
      },
      { status: 200 },
    )
    logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'PaymentsCreateOrderAPI', methodName: 'POST', err }, start)
    return res
  }
}

