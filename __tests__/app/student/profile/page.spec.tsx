/**
 * FILE OBJECTIVE:
 * - Unit tests for the student profile page update entry point.
 * - Verifies the Update Profile action routes to onboarding edit mode.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/student/profile/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-10T00:00:00Z | copilot | add coverage for profile update link edit-mode routing
 * - 2026-05-10T00:00:00Z | copilot | replace jest-dom matcher assertion with direct href check
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

import ProfilePage from '@/app/(student)/profile/page'

const replaceMock = jest.fn()

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: replaceMock,
  }),
}))

jest.mock('@/hooks/useCurrentUser', () => ({
  __esModule: true,
  default: () => ({
    data: {
      name: 'Aarav Sharma',
      email: 'aarav@example.com',
      level: 1,
      currentStreak: 2,
      longestStreak: 4,
      language: 'en',
      board: 'cbse',
      grade: 8,
      subjects: ['math'],
      role: 'student',
      plan: 'free',
      billingCycle: 'monthly',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    loading: false,
  }),
}))

jest.mock('@/components/UI/Avatar', () => ({
  __esModule: true,
  default: () => <div data-testid="avatar" />,
}))

jest.mock('@/components/Auth/LogoutButton', () => ({
  __esModule: true,
  default: () => <button type="button">Logout</button>,
}))

jest.mock('@/components/ProfileWidgets', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-widgets" />,
}))

jest.mock('@/components/AuthRedeemOnSignIn', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/Profile/ParentAccessCard', () => ({
  __esModule: true,
  default: () => <div data-testid="parent-access-card" />,
}))

jest.mock('@/components/UI/FontSizeToggle', () => ({
  __esModule: true,
  default: () => <div data-testid="font-size-toggle" />,
}))

jest.mock('@/components/UI/loaders', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
}))

jest.mock('@/components/CascadingFilters', () => ({
  LANGUAGES: [{ code: 'en', name: 'English' }],
  _DIFFICULTY_LEVELS: [],
}))

jest.mock('@/lib/extractBadge', () => ({
  extractBadges: () => [],
}))

jest.mock('@/lib/student/xpLevels', () => ({
  getTierColor: () => '#000000',
}))

import { useSession } from 'next-auth/react'

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Aarav Sharma',
          email: 'aarav@example.com',
          image: null,
          role: 'student',
        },
      },
      status: 'authenticated',
      update: jest.fn(),
    } as never)
  })

  it('routes Update Profile through onboarding edit mode', () => {
    render(<ProfilePage />)

    const updateProfileLink = screen.getByRole('link', { name: 'Update Profile' })
    expect(updateProfileLink.getAttribute('href')).toBe('/student/onboarding?edit=1')
  })
})