/**
 * FILE OBJECTIVE:
 * - Unit tests for app/(public)/page.tsx authenticated-user redirect logic.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | created tests for landing-page session-aware routing
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const redirectMock = jest.fn((url: string) => {
  // next/navigation.redirect throws to short-circuit rendering
  const err: any = new Error(`NEXT_REDIRECT:${url}`)
  err.digest = `NEXT_REDIRECT;${url}`
  throw err
})
const getServerSessionMock = jest.fn()

jest.mock('next/navigation', () => ({ redirect: redirectMock }))
jest.mock('next-auth/next', () => ({ getServerSession: getServerSessionMock }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('../../../../app/(public)/landing-page/components/LandingPageInteractive', () => ({
  __esModule: true,
  default: () => null,
}))

import HomePage from '../../../../app/(public)/page'

describe('app/(public)/page HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders landing page when there is no session', async () => {
    getServerSessionMock.mockResolvedValue(null)
    await expect(HomePage()).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects to /dashboard when active + onboardingComplete', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { onboardingComplete: true, accountStatus: 'active' },
    })
    await expect(HomePage()).rejects.toThrow(/NEXT_REDIRECT:\/dashboard/)
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /student/onboarding when logged in but pending_parent_verification', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { onboardingComplete: false, accountStatus: 'pending_parent_verification' },
    })
    await expect(HomePage()).rejects.toThrow(/NEXT_REDIRECT:\/student\/onboarding/)
    expect(redirectMock).toHaveBeenCalledWith('/student/onboarding')
  })

  it('redirects to /student/onboarding when active but onboarding incomplete', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { onboardingComplete: false, accountStatus: 'active' },
    })
    await expect(HomePage()).rejects.toThrow(/NEXT_REDIRECT:\/student\/onboarding/)
    expect(redirectMock).toHaveBeenCalledWith('/student/onboarding')
  })
})
