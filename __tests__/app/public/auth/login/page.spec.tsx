/**
 * FILE OBJECTIVE:
 * - Validate the /auth/login returning-user page: callbackUrl sanitization,
 *   Google OAuth error banner, email magic-link success and error states,
 *   and the "New to Spinzy?" link presence.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/login/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | create tests for /auth/login page
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(public)/auth/login/page'

const signInMock = jest.fn()
const getParamMock = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getParamMock }),
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
  GoogleLogo: () => <svg data-testid="google-logo" />,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamMock.mockReturnValue(null)
    signInMock.mockResolvedValue(undefined)
  })

  it('should render "Welcome back" headline', () => {
    render(<LoginPage />)
    expect(screen.getByText('Welcome back')).toBeTruthy()
  })

  it('should render a "New to Spinzy?" link pointing to /auth/get-started', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /get started free/i })
    expect((link as HTMLAnchorElement).href).toContain('/auth/get-started')
  })

  it('should call signIn("google") with sanitized callbackUrl', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'callbackUrl' ? '/student/onboarding' : null
    )

    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/student/onboarding' })
  })

  it('should fall back to /dashboard for an unsafe callbackUrl', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'callbackUrl' ? 'https://evil.com' : null
    )

    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' })
  })

  it('should show Google error banner and "Retry" label on ?error=Callback', () => {
    getParamMock.mockImplementation((key: string) =>
      key === 'error' ? 'Callback' : null
    )

    render(<LoginPage />)

    expect(screen.getByText(/google sign-in did not complete/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry with google/i })).toBeTruthy()
  })

  it('should show email sent confirmation after successful magic-link request', async () => {
    signInMock.mockResolvedValueOnce({ error: null })

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/your email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeTruthy()
    })
  })

  it('should show an error when signIn("email") returns an error', async () => {
    signInMock.mockResolvedValueOnce({ error: 'EmailSignin' })

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/your email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(screen.getByText(/could not send email/i)).toBeTruthy()
    })
  })

  it('should validate email format before calling signIn', async () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/your email address/i)
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeTruthy()
    })
    expect(signInMock).not.toHaveBeenCalledWith('email', expect.anything())
  })
})
