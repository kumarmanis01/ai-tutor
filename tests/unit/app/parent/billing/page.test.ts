/**
 * Unit test for ParentBillingPage server component. Mocks prisma and session
 * and verifies EMI schedule and Retry link are rendered in the generated HTML.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'

jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }))
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

describe('ParentBillingPage', () => {
  beforeEach(() => resetPrismaMock())

  it('renders EMI schedule and retry link', async () => {
    const session = { user: { id: 'parent-1', role: 'parent' } }
    const { getServerSession } = require('next-auth/next')
    getServerSession.mockResolvedValue(session)

    prismaMock.parentStudent.findMany.mockResolvedValue([{ studentId: 's1' }])
    prismaMock.user.findUnique.mockResolvedValue({ id: 's1', name: 'Child', grade: '6', board: 'CBSE' })
    prismaMock.subscription.findFirst.mockResolvedValue({
      id: 'sub-1', userId: 'parent-1', active: true, plan: 'individual', billingCycle: 'annual', endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      installments: [{ id: 'inst-1', number: 1, dueAt: new Date().toISOString(), amount: 10000, status: 'PENDING' }],
    })

    // Import the page after mocks are set up to ensure module-level imports see mocks
    const ParentBillingPage = require('@/app/(parent)/parent/billing/page').default

    const html = renderToStaticMarkup(await ParentBillingPage())
    expect(html).toMatch(/EMI schedule/i)
    expect(html).toMatch(/Installment 1/)
    expect(html).toMatch(/Retry payment/)
    expect(html).toMatch(/₹|INR|Rs\.?/) // currency present
  })
})
