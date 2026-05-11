/**
 * FILE OBJECTIVE:
 * - Verify parent onboarding route enforces parent role and redirects with invite-code-aware linking behavior.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/parent/onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add unit coverage for parent onboarding role assignment and redirects
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import ParentOnboardingPage from '@/app/(parent)/parent/onboarding/page'

const replaceMock = jest.fn()
const getParamMock = jest.fn()
const useSessionMock = jest.fn()

jest.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: getParamMock }),
}))

jest.mock('@/components/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo">Logo</div>,
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

describe('ParentOnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamMock.mockImplementation((key: string) => {
      if (key === 'inviteCode') {
        return 'ABCD1234'
      }
      return null
    })
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('redirects unauthenticated users to parent-intent sign in', async () => {
    useSessionMock.mockReturnValue({ status: 'unauthenticated', data: null })

    render(<ParentOnboardingPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        '/auth/signin?role=parent&callbackUrl=%2Fparent%2Fonboarding%3FinviteCode%3DABCD1234&inviteCode=ABCD1234'
      )
    })
  })

  it('assigns parent role for authenticated users and redirects to link flow with prefilled code', async () => {
    useSessionMock.mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1', role: 'user' } } })

    render(<ParentOnboardingPage />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'parent' }),
      })
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/parent?mode=code&inviteCode=ABCD1234')
    })
  })

  it('redirects existing parent users directly to link flow', async () => {
    useSessionMock.mockReturnValue({ status: 'authenticated', data: { user: { id: 'u2', role: 'parent' } } })

    render(<ParentOnboardingPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/parent?mode=code&inviteCode=ABCD1234')
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
