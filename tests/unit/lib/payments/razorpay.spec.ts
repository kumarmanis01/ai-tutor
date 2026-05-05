/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/payments/razorpay.ts: order creation, signature
 *   verification, and subscription activation (including FreeTierUsage reset).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/payments/razorpay.spec.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | claude | initial creation -- covers activateSubscription periodStart fix
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }))
jest.mock('razorpay', () => jest.fn())

import { prisma } from '@/lib/prisma'
import { activateSubscription, verifyPaymentSignature } from '@/lib/payments/razorpay'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('activateSubscription', () => {
  const studentId = 'stu_test_1'
  const razorpayOrderId = 'order_test_1'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.RAZORPAY_KEY_ID = 'test_key'
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'
  })

  it('should return true when transaction succeeds', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId, status: 'created', id: 'po_1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      freeTierUsage: { upsert: jest.fn().mockResolvedValue({}) },
    }))

    const result = await activateSubscription(studentId, razorpayOrderId)
    expect(result).toBe(true)
  })

  it('should return false when order studentId mismatches', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId: 'other_student', status: 'created', id: 'po_1' }),
      },
      user: { update: jest.fn() },
      freeTierUsage: { upsert: jest.fn() },
    }))

    const result = await activateSubscription(studentId, razorpayOrderId)
    expect(result).toBe(false)
  })

  it('should return false when order is not found', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { update: jest.fn() },
      freeTierUsage: { upsert: jest.fn() },
    }))

    const result = await activateSubscription(studentId, razorpayOrderId)
    expect(result).toBe(false)
  })

  it('should use normalized month-start (1st at 00:00) as periodStart in FreeTierUsage upsert', async () => {
    const freeTierUpsert = jest.fn().mockResolvedValue({})
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId, status: 'created', id: 'po_1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      freeTierUsage: { upsert: freeTierUpsert },
    }))

    await activateSubscription(studentId, razorpayOrderId)

    expect(freeTierUpsert).toHaveBeenCalledTimes(1)
    const upsertCall = freeTierUpsert.mock.calls[0][0]
    const periodStart: Date = upsertCall.where.studentId_subjectScope_periodStart.periodStart

    // Must be 1st of the month at 00:00:00.000
    expect(periodStart.getDate()).toBe(1)
    expect(periodStart.getHours()).toBe(0)
    expect(periodStart.getMinutes()).toBe(0)
    expect(periodStart.getSeconds()).toBe(0)
    expect(periodStart.getMilliseconds()).toBe(0)

    // Create data must use the same date
    const createPeriodStart: Date = upsertCall.create.periodStart
    expect(createPeriodStart.getTime()).toBe(periodStart.getTime())
  })

  it('should be idempotent: re-activating a paid order still returns true', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({ studentId, status: 'paid', id: 'po_1' }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      freeTierUsage: { upsert: jest.fn().mockResolvedValue({}) },
    }))

    const result = await activateSubscription(studentId, razorpayOrderId)
    expect(result).toBe(true)
  })
})

describe('verifyPaymentSignature', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'
  })

  it('should return false when RAZORPAY_KEY_SECRET is missing', async () => {
    delete process.env.RAZORPAY_KEY_SECRET
    const result = await verifyPaymentSignature({ orderId: 'o', paymentId: 'p', signature: 'sig' })
    expect(result).toBe(false)
  })

  it('should return false when signature length does not match', async () => {
    const result = await verifyPaymentSignature({ orderId: 'o', paymentId: 'p', signature: 'abc' })
    expect(result).toBe(false)
  })

  it('should return false for a tampered signature', async () => {
    const result = await verifyPaymentSignature({
      orderId: 'order_abc',
      paymentId: 'pay_xyz',
      signature: 'a'.repeat(64),
    })
    expect(result).toBe(false)
  })
})
