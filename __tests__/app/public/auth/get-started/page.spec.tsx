/**
 * FILE OBJECTIVE:
 * - Validate /auth/get-started: role tile rendering, student/parent signIn calls,
 *   inviteCode fast-path, ?source=parent highlight, authenticated redirect,
 *   and OAuth error banner.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/get-started/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | create tests for /auth/get-started page
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GetStartedPage from '@/app/(public)/auth/get-started/page'

const signInMock = jest.fn()
const getParamMock = jest.fn()
const replaceMock = jest.fn()
let sessionStatus = 'unauthenticated'
let sessionData: unknown = null

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  useSession: () => ({ data: sessionData, status: sessionStatus }),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getParamMock }),
  useRouter: () => ({ replace: replaceMock }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

jest.mock('@/components/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo">Logo</div>,
}))

jest.mock('@/components/UI/design-system', () => ({
  Spinner: () => <div data-testid="spinner" />,
}))

describe('GetStartedPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamMock.mockReturnValue(null)
    sessionStatus = 'unauthenticated'
    sessionData = null
    signInMock.mockResolvedValue(undefined)
  })

  it('should render both role tiles when unauthenticated', () => {
    render(<GetStartedPage />)

    expect(screen.getByText("I'm a student")).toBeTruthy()
    expect(screen.getByText("I'm a parent")).toBeTruthy()
  })

  it('clicking student tile calls signIn("google") with /student/onboarding callback', async () => {
    render(<GetStartedPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign up as student/i }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/student/onboarding' })
    })
  })

  it('clicking parent tile calls signIn("google") with /parent/onboarding callback', async () => {
    render(<GetStartedPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign up as parent/i }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/parent/onboarding' })
    })
  })

  it('?inviteCode=XYZ auto-triggers parent Google flow with inviteCode in callbackUrl', async () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'inviteCode' ? 'XYZ123' : null
    )

    render(<GetStartedPage />)

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('google', {
        callbackUrl: '/parent/onboarding?inviteCode=XYZ123',
      })
    })
  })

  it('?source=parent shows "Recommended" pill on the parent tile', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'source' ? 'parent' : null
    )

    render(<GetStartedPage />)

    expect(screen.getByText('Recommended')).toBeTruthy()
  })

  it('authenticated student users are redirected to /student/onboarding', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { role: 'student' } }

    render(<GetStartedPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/student/onboarding')
    })
  })

  it('authenticated parent users are redirected to /parent/onboarding', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { role: 'parent' } }

    render(<GetStartedPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/parent/onboarding')
    })
  })

  it('shows "Already have an account?" link pointing to /auth/login', () => {
    render(<GetStartedPage />)

    const link = screen.getByRole('link', { name: /log in/i })
    expect((link as HTMLAnchorElement).href).toContain('/auth/login')
  })

  it('shows OAuth error banner when ?error=Callback is present', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'error' ? 'Callback' : null
    )

    render(<GetStartedPage />)

    expect(screen.getByText(/google sign-in did not complete/i)).toBeTruthy()
  })
})
