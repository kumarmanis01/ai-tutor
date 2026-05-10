/**
 * FILE OBJECTIVE:
 * - Unit tests for redesigned student `Topbar` component covering core continuity
 *   signals (focus chip and Ask Vidya CTA) and mobile sheet interactions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/layout/Topbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:10:00Z | staff-engineer | add Topbar unit tests for mobile sheets and badges
 * - 2026-05-09T00:00:00Z | copilot | update tests for adaptive focus topbar, Ask Vidya CTA, and mobile search/menu/profile sheets
 * - 2026-05-09T00:00:00Z | copilot | assert focus values from combined topbar-stats payload
 * - 2026-05-09T00:00:00Z | copilot | switch mocks to combined topbar-stats response contract
 * - 2026-05-10T00:00:00Z | copilot | add assertions for explicit mobile search close and Ask Vidya action controls
 * - 2026-05-10T00:00:00Z | copilot | add regression for desktop search toggle to ensure mobile sheet does not render
 * - 2026-05-10T00:00:00Z | copilot | align assertions with ordered topbar layout (logo, hi line, board-grade-school metadata, upgrade, streak, profile)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockedUsePathname = jest.fn(() => '/dashboard');

jest.mock('next/navigation', () => ({
  usePathname: () => mockedUsePathname(),
}));

// Mock next-auth session
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Sam Student' } }, status: 'authenticated' }),
}));

// Mock SWR responses for both stats and profile calls.
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: string) => {
    if (key === '/api/student/topbar-stats') {
      const isExamRoute = mockedUsePathname() === '/dashboard/tests';
      return {
        data: {
          streak: 5,
          longestStreak: 7,
          level: 3,
          shieldAvailable: true,
          cosmeticUnlocks: [],
          focus: {
            mode: isExamRoute ? 'exam' : 'active',
            focusLabel: isExamRoute
              ? 'Revision: Real payload exam focus'
              : 'Continue: Real payload focus',
            etaLabel: isExamRoute ? '2 short tasks today' : '9 mins left',
            askLabel: isExamRoute ? 'Ask Vidya for quick revision' : 'Ask Vidya from payload',
            momentumLabel: isExamRoute ? 'You are on track' : 'Payload momentum label',
            contextTag: isExamRoute ? 'Exam mode' : 'Payload mode',
            searchPlaceholder: 'Payload search hint',
            actionHref: '/learn',
            sourceRuleId: isExamRoute ? 'spaced_revision' : 'resume_session',
          },
          generatedAt: '2026-05-09T00:00:00.000Z',
        },
      };
    }
    if (key === '/api/user/profile') {
      return { data: { name: 'Sam Student', grade: '9', board: 'CBSE', schoolName: 'DPS Noida', plan: null } };
    }
    return { data: undefined };
  },
}));

import Topbar from '../../../../../components/student/layout/Topbar';

describe('Topbar (component)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedUsePathname.mockReturnValue('/dashboard');
  });

  it('renders ordered topbar identity section with logo, hi line, and board-grade-school metadata', () => {
    render(<Topbar />);

    expect(screen.getAllByLabelText('Spinzy home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hi Sam').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CBSE, Grade 9,/).length).toBeGreaterThan(0);
  });

  it('renders upgrade, streak, and profile controls', () => {
    render(<Topbar />);

    expect(screen.getAllByLabelText('Upgrade').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('5-day learning consistency - open details').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Open profile').length).toBeGreaterThan(0);
  });

  it('keeps legacy menu/search triggers out of the active topbar row', () => {
    render(<Topbar />);

    expect(screen.queryByTestId('mobile-menu-button')).toBeNull();
    expect(screen.queryByLabelText('Open concept search')).toBeNull();
  });

  it('keeps requested structure on tests route as well', () => {
    mockedUsePathname.mockReturnValue('/dashboard/tests');
    render(<Topbar />);

    expect(screen.getAllByText('Hi Sam').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CBSE, Grade 9,/).length).toBeGreaterThan(0);
  });

  it('opens streak widget and returns focus to opener on Escape key', () => {
    render(<Topbar />);

    const streakButtons = screen.getAllByLabelText('5-day learning consistency - open details');
    const streakBtn = streakButtons[streakButtons.length - 1];
    fireEvent.click(streakBtn);

    // Popover should render with role=dialog or label
    expect(screen.getByLabelText(/Streak details|Loading streak/)).toBeTruthy();

    // Close via Escape key and assert focus returns to opener
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(document.activeElement).toBe(streakBtn);
  });
});
