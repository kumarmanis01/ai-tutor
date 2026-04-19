import { createCoupon, validateCoupon, redeemCoupon } from '@/lib/coupon'

describe('coupon helpers', () => {
  test('createCoupon calls prisma.create', async () => {
    const prisma: any = { coupon: { create: jest.fn().mockResolvedValue({ id: 'c1', code: 'WELCOME' }) } }
    const input = { code: 'WELCOME', type: 'FIXED', amount: 10000 }
    const res = await createCoupon(prisma, input as any)
    expect(prisma.coupon.create).toHaveBeenCalled()
    expect(res).toEqual({ id: 'c1', code: 'WELCOME' })
  })

  test('validateCoupon returns 404 for missing code', async () => {
    const tx: any = { coupon: { findUnique: jest.fn().mockResolvedValue(null) } }
    const v = await validateCoupon(tx, 'NOPE')
    expect(v.status).toBe(404)
    expect(v.body.error).toBe('invalid_code')
  })

  test('validateCoupon denies student-scoped coupon for other user', async () => {
    const couponRow = { id: 'c1', active: true, validFrom: null, validUntil: null, maxUses: null, uses: 0, scope: 'STUDENT', studentId: 'u1', maxUsesPerUser: null }
    const tx: any = { coupon: { findUnique: jest.fn().mockResolvedValue(couponRow) } }
    const v = await validateCoupon(tx, 'CODE', 'u2')
    expect(v.status).toBe(403)
    expect(v.body.error).toBe('not_permitted')
  })

  test('redeemCoupon for FIXED applies credit to subscription', async () => {
    const couponRow = { id: 'cfix', code: 'FIX10', active: true, validFrom: null, validUntil: null, maxUses: null, uses: 0, type: 'FIXED', amount: 500, scope: 'GLOBAL', studentId: null }
    const tx: any = {
      coupon: { findUnique: jest.fn().mockResolvedValue(couponRow), update: jest.fn().mockResolvedValue({ ...couponRow, uses: 1 }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub1' }), update: jest.fn().mockResolvedValue({ id: 'sub1', creditBalance: 500 }) },
      couponRedemption: { create: jest.fn().mockResolvedValue({ id: 'r1' }), count: jest.fn().mockResolvedValue(0) },
    }

    const r = await redeemCoupon(tx, 'FIX10', 'some-user')
    expect(tx.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub1' }, data: { creditBalance: { increment: 500 } } })
    expect(tx.couponRedemption.create).toHaveBeenCalled()
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
  })
})
