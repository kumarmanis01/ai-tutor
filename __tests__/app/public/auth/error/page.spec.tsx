/**
 * FILE OBJECTIVE:
 * - Validate that AuthErrorPage renders the correct human-readable message for each
 *   known NextAuth error code and that unsafe callbackUrl values are never navigated to.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/error/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add error message selection and open-redirect guard tests
 */

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import AuthErrorPage from '@/app/(public)/auth/error/page'

const getParamMock = jest.fn()
const routerPushMock = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getParamMock }),
  useRouter: () => ({ push: routerPushMock }),
}))

jest.mock('@/components/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo">Logo</div>,
}))

describe('AuthErrorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamMock.mockReturnValue(null)
  })

  it('should render the Callback error message for error=Callback', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'error' ? 'Callback' : null
    )

    render(<AuthErrorPage />)

    expect(screen.getByText(/google sign-in could not be completed/i)).toBeTruthy()
  })

  it('should render the OAuthAccountNotLinked message for that error code', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'error' ? 'OAuthAccountNotLinked' : null
    )

    render(<AuthErrorPage />)

    expect(screen.getByText(/already registered with a different sign-in method/i)).toBeTruthy()
  })

  it('should render the default message for an unknown error code', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'error' ? 'SomethingUnknown' : null
    )

    render(<AuthErrorPage />)

    expect(screen.getByText(/something went wrong during sign-in/i)).toBeTruthy()
  })

  it('should render the default message when no error code is present', () => {
    render(<AuthErrorPage />)

    expect(screen.getByText(/something went wrong during sign-in/i)).toBeTruthy()
  })

  it('should navigate to /auth/get-started when Try again is clicked', () => {
    render(<AuthErrorPage />)

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(routerPushMock).toHaveBeenCalledWith('/auth/get-started')
  })

  it('should use sanitized callbackUrl for Go back with a safe path', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'callbackUrl' ? '/student/onboarding' : null
    )

    render(<AuthErrorPage />)

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(routerPushMock).toHaveBeenCalledWith('/student/onboarding')
  })

  it('should reject a protocol-relative callbackUrl (open-redirect guard)', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'callbackUrl' ? '//evil.com' : null
    )

    render(<AuthErrorPage />)

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(routerPushMock).toHaveBeenCalledWith('/auth/get-started')
    expect(routerPushMock).not.toHaveBeenCalledWith('//evil.com')
  })

  it('should reject an absolute external callbackUrl (open-redirect guard)', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'callbackUrl' ? 'https://evil.com/steal' : null
    )

    render(<AuthErrorPage />)

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(routerPushMock).toHaveBeenCalledWith('/auth/get-started')
  })
})
