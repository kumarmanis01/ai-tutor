/**
 * FILE OBJECTIVE:
 * - Validate sign-in callback behavior for standard and parent-intent onboarding routes.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/signin/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add callbackUrl and parent-intent sign-in route coverage
 */

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import AuthPage from '@/app/(public)/auth/signin/page'

const signInMock = jest.fn()
const getParamMock = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getParamMock }),
}))

jest.mock('@/components/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo">Logo</div>,
}))

describe('AuthPage callback handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamMock.mockReturnValue(null)
  })

  it('uses sanitized callbackUrl for standard login', async () => {
    getParamMock.mockImplementation((key: string) => {
      if (key === 'callbackUrl') {
        return '/student/onboarding'
      }
      return null
    })

    render(<AuthPage />)

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/student/onboarding' })
  })

  it('routes parent intent to parent onboarding callback with invite code', async () => {
    getParamMock.mockImplementation((key: string) => {
      if (key === 'role') {
        return 'parent'
      }
      if (key === 'inviteCode') {
        return 'ABCD1234'
      }
      if (key === 'callbackUrl') {
        return '/dashboard'
      }
      return null
    })

    render(<AuthPage />)

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(signInMock).toHaveBeenCalledWith('google', {
      callbackUrl: '/parent/onboarding?inviteCode=ABCD1234',
    })
  })
})
