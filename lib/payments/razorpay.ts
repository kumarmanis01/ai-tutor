import Razorpay from 'razorpay'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

function getClient() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return null
  }
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  })
}

/**
 * Create a Razorpay order for ₹99/month.
 * Returns razorpayOrderId to pass to frontend SDK.
 * Never throws -- returns null on error.
 */
export async function createRazorpayOrder(
  studentId: string,
  planMonths: number = 1,
): Promise<{ orderId: string; amount: number; currency: string } | null> {
  try {
    const client = getClient()
    if (!client) return null

    const safeMonths = Math.max(1, Math.min(Math.floor(planMonths || 1), 12))
    const amount = 9900 * safeMonths // in paise
    const currency = 'INR'

    const order = await client.orders.create({
      amount,
      currency,
      notes: {
        studentId,
        planMonths: String(safeMonths),
      },
    })

    if (!order?.id) return null

    return { orderId: order.id, amount, currency }
  } catch {
    return null
  }
}

/**
 * Verify Razorpay payment signature.
 * HMAC-SHA256 of `${orderId}|${paymentId}` with KEY_SECRET.
 * Returns true only if signature matches exactly.
 * This is the security gate -- never skip.
 */
export async function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): Promise<boolean> {
  try {
    if (!RAZORPAY_KEY_SECRET) return false
    const payload = `${params.orderId}|${params.paymentId}`
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(payload).digest('hex')

    const sigBuf = Buffer.from(params.signature || '', 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/**
 * Activate subscription after verified payment.
 * 1. Update PaymentOrder.status = 'paid', paidAt = now()
 * 2. Update User.subscriptionStatus = 'active'
 * 3. Set User.subscriptionExpiry = now() + planMonths * 30 days
 * 4. Reset FreeTierUsage for the student
 * All in a Prisma transaction.
 * Never throws -- returns false on error.
 */
export async function activateSubscription(
  studentId: string,
  razorpayOrderId: string,
  planMonths: number,
): Promise<boolean> {
  try {
    const safeMonths = Math.max(1, Math.min(Math.floor(planMonths || 1), 12))
    const now = new Date()
    const expiry = new Date(now.getTime() + safeMonths * 30 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({
        where: { razorpayOrderId },
      })
      if (!order || order.studentId !== studentId) {
        throw new Error('ORDER_STUDENT_MISMATCH')
      }

      if (order.status === 'paid') {
        // Idempotent: still ensure user is active + free tier reset.
        await tx.user.update({
          where: { id: studentId },
          data: {
            subscriptionStatus: 'active',
            subscriptionExpiry: expiry,
          },
        })
      } else {
        await tx.paymentOrder.update({
          where: { razorpayOrderId },
          data: {
            status: 'paid',
            paidAt: now,
          },
        })
        await tx.user.update({
          where: { id: studentId },
          data: {
            subscriptionStatus: 'active',
            subscriptionExpiry: expiry,
          },
        })
      }

      // Reset FreeTierUsage for the student
      await tx.freeTierUsage
        .upsert({
          where: { studentId },
          update: {
            periodStart: now,
            sessionsUsed: 0,
          },
          create: {
            studentId,
            periodStart: now,
            sessionsUsed: 0,
          },
        })
        .catch(() => {})
    })

    return true
  } catch {
    return false
  }
}

