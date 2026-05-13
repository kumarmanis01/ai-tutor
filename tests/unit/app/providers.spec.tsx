/**
 * FILE OBJECTIVE:
 * - Unit tests for app/providers.tsx app lifecycle analytics hooks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/providers.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add app open and app close analytics coverage for root providers
 * - 2026-05-13T00:00:00Z | copilot | add role-scoped app lifecycle analytics coverage for student, parent, and admin routes
 */

import React from 'react'
import { fireEvent, render } from '@testing-library/react'

const trackEventMock = jest.fn()
const flushEventsMock = jest.fn()

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('next/script', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/UI/ThemeProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/context/OnboardingProvider', () => ({
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/UI/AlertModal', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/lib/analytics/client', () => ({
  __esModule: true,
  default: {
    trackEvent: trackEventMock,
    flushEvents: flushEventsMock,
  },
}))

describe('app/providers', () => {
  beforeEach(() => {
    trackEventMock.mockReset()
    flushEventsMock.mockReset()
    window.history.pushState({}, '', '/')
  })

  test('tracks app open on mount and app close on pagehide', async () => {
    const Providers = (await import('@/app/providers')).default

    render(
      <Providers>
        <div>Child</div>
      </Providers>,
    )

    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'student.app.open' })

    fireEvent(window, new Event('pagehide'))

    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'student.app.close' })
    expect(flushEventsMock).toHaveBeenCalled()
  })

  test('tracks parent app lifecycle on parent route', async () => {
    const Providers = (await import('@/app/providers')).default
    window.history.pushState({}, '', '/parent/dashboard')

    render(
      <Providers>
        <div>Child</div>
      </Providers>,
    )

    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'parent.app.open' })

    fireEvent(window, new Event('pagehide'))
    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'parent.app.close' })
  })

  test('tracks admin app lifecycle on admin route', async () => {
    const Providers = (await import('@/app/providers')).default
    window.history.pushState({}, '', '/admin/analytics/events')

    render(
      <Providers>
        <div>Child</div>
      </Providers>,
    )

    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'admin.app.open' })

    fireEvent(window, new Event('pagehide'))
    expect(trackEventMock).toHaveBeenCalledWith({ eventType: 'admin.app.close' })
  })
})
