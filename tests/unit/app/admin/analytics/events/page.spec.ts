/**
 * FILE OBJECTIVE:
 * - Unit tests for the Event Analytics admin page.
 *   Verifies auth guard, successful render path, and that the page
 *   reads from AnalyticsEvent (not from readiness/progress tables).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/analytics/events/page.spec.ts  (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | created
 */

import React from 'react'

const mockSession = { user: { id: 'admin-1', role: 'admin' } }
const mockPrismaCount = jest.fn()
const mockPrismaFindMany = jest.fn()
const mockPrismaGroupBy = jest.fn()

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    analyticsEvent: {
      count: (...args: unknown[]) => mockPrismaCount(...args),
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
      groupBy: (...args: unknown[]) => mockPrismaGroupBy(...args),
    },
  },
}))

jest.mock('../../../../components/admin/AdminTopbar', () => ({
  AdminTopbar: ({ title }: { title: string }) => <div data-testid="topbar">{title}</div>,
}))

// Silence React server-component async in jsdom
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: unknown) => fn,
}))

import { getServerSessionForHandlers } from '@/lib/session'

describe('EventAnalyticsPage', () => {
  beforeEach(() => {
    jest.resetModules()
    mockPrismaCount.mockResolvedValue(0)
    mockPrismaFindMany.mockResolvedValue([])
    mockPrismaGroupBy.mockResolvedValue([])
  })

  it('returns Unauthorized when session is missing', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue(null)

    const { default: Page } = await import(
      '@/app/admin/analytics/events/page'
    )

    // Cast to any to call as a server component function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Page as any)()
    const { render } = await import('@testing-library/react')
    const { getByText } = render(result as React.ReactElement)
    expect(getByText('Unauthorized')).toBeTruthy()
  })

  it('returns Unauthorized for non-admin role', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
    })

    const { default: Page } = await import(
      '@/app/admin/analytics/events/page'
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Page as any)()
    const { render } = await import('@testing-library/react')
    const { getByText } = render(result as React.ReactElement)
    expect(getByText('Unauthorized')).toBeTruthy()
  })

  it('renders Event Analytics page for admin and queries AnalyticsEvent table', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue(mockSession)

    // Simulate some events in the DB
    mockPrismaCount.mockResolvedValue(42)
    mockPrismaFindMany.mockResolvedValue([])
    mockPrismaGroupBy.mockResolvedValue([
      { eventType: 'student.session.start', _count: { _all: 10 } },
      { eventType: 'student.session.complete', _count: { _all: 8 } },
    ])

    const { default: Page } = await import(
      '@/app/admin/analytics/events/page'
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Page as any)()
    const { render } = await import('@testing-library/react')
    const { getByTestId, getByText } = render(result as React.ReactElement)

    // Topbar renders correct title
    expect(getByTestId('topbar').textContent).toBe('Event Analytics')

    // Page uses AnalyticsEvent table (count was called)
    expect(mockPrismaCount).toHaveBeenCalled()

    // Page does NOT query structuredSession or studentTopicProgress
    expect(mockPrismaFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ completedAt: expect.anything() }) }),
    )

    // Renders a label from CORE_EVENT_DEFINITIONS
    expect(getByText('Session start')).toBeTruthy()
  })

  it('renders moderator-level access correctly', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'mod-1', role: 'moderator' },
    })

    const { default: Page } = await import(
      '@/app/admin/analytics/events/page'
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Page as any)()
    const { render } = await import('@testing-library/react')
    const { getByTestId } = render(result as React.ReactElement)
    expect(getByTestId('topbar').textContent).toBe('Event Analytics')
  })

  it('shows zero counts when AnalyticsEvent table is empty', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue(mockSession)
    mockPrismaCount.mockResolvedValue(0)
    mockPrismaFindMany.mockResolvedValue([])
    mockPrismaGroupBy.mockResolvedValue([])

    const { default: Page } = await import(
      '@/app/admin/analytics/events/page'
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Page as any)()
    const { render } = await import('@testing-library/react')
    const { getAllByText } = render(result as React.ReactElement)

    // All counts default to 0 — verify at least one "0" appears
    expect(getAllByText('0').length).toBeGreaterThan(0)
  })
})
