/**
 * FILE OBJECTIVE:
 * - Unit tests for the student onboarding page visual shell.
 * - Verifies the form renders after hierarchy loading, uses theme-based classes,
 *   and honors edit mode for active users.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/student/onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add coverage for onboarding theme class usage
 * - 2026-05-10T00:00:00Z | copilot | add regression coverage for always-visible parent contact inputs
 * - 2026-05-10T00:00:00Z | copilot | replace jest-dom matcher assertions with plain DOM checks
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import StudentOnboardingPage from '@/app/(student)/student/onboarding/page'

const replaceMock = jest.fn()
const searchParamsMock = {
  get: jest.fn(),
}
const routerMock = {
  replace: replaceMock,
}

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}))

jest.mock('@/components/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo">Logo</div>,
}))

import { useSession } from 'next-auth/react'

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

describe('StudentOnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    searchParamsMock.get.mockReturnValue(null)
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Aarav',
          onboardingComplete: false,
          accountStatus: 'pending',
        },
      },
      status: 'authenticated',
      update: jest.fn(),
    } as never)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        boards: [
          {
            id: 'board-1',
            name: 'CBSE',
            slug: 'cbse',
            classes: [
              {
                id: 'class-8',
                grade: 8,
                slug: 'class-8',
                subjects: [
                  { id: 'math', name: 'Mathematics', slug: 'math' },
                ],
              },
            ],
          },
        ],
        languages: [
          { code: 'en', name: 'English' },
          { code: 'hi', name: 'Hindi' },
        ],
      }),
    }) as jest.Mock
  })

  it('renders the form shell with semantic theme classes after loading hierarchy', async () => {
    const { container } = render(<StudentOnboardingPage />)

    await screen.findByText('Set up your profile')

    expect(screen.getByText('Student onboarding')).not.toBeNull()
    expect(container.firstChild).toHaveClass('bg-background', 'text-foreground')

    const panel = container.querySelector('.bg-card\/95')
    expect(panel).toHaveClass('border-border/80')

    const submitButton = screen.getByRole('button', { name: 'Start learning' })
    expect(submitButton).toHaveClass('bg-primary', 'text-primary-foreground')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/academic-hierarchy')
    })
  })

  it('shows parent contact fields even before the age gate is known', async () => {
    render(<StudentOnboardingPage />)

    await screen.findByText('Set up your profile')

    expect(screen.getByText('Parent contact information')).not.toBeNull()
    expect(screen.getByLabelText('Parent email')).not.toBeNull()
    expect(screen.getByLabelText('Parent WhatsApp number')).not.toBeNull()
  })

  it('does not redirect active users to the dashboard when edit mode is enabled', async () => {
    searchParamsMock.get.mockImplementation((key: string) => (key === 'edit' ? '1' : null))
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Aarav',
          onboardingComplete: true,
          accountStatus: 'active',
        },
      },
      status: 'authenticated',
      update: jest.fn(),
    } as never)

    render(<StudentOnboardingPage />)

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalledWith('/dashboard')
    })
  })
})