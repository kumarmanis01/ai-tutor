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
 * - 2026-05-09T00:00:00Z | copilot | add dedicated topbar-focus API payload mock assertions
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
      return { data: { streak: 5, level: 3, shieldAvailable: true } };
    }
    if (key === '/api/user/profile') {
      return { data: { name: 'Sam Student', grade: '9', board: 'CBSE', plan: null } };
    }
    if (key === '/api/student/topbar-focus') {
      const isExamRoute = mockedUsePathname() === '/dashboard/tests';
      return {
        data: {
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
    return { data: undefined };
  },
}));

import Topbar from '../../../../../components/student/layout/Topbar';

describe('Topbar (component)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedUsePathname.mockReturnValue('/dashboard');
  });

  it('renders continuation focus and Ask Vidya CTA on desktop', () => {
    render(<Topbar />);

    expect(screen.getAllByLabelText('Spinzy home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Continue: Real payload focus').length).toBeGreaterThan(0);
    expect(screen.getByText('Ask Vidya from payload')).toBeTruthy();
  });

  it('switches to exam mode copy on tests route', () => {
    mockedUsePathname.mockReturnValue('/dashboard/tests');
    render(<Topbar />);

    expect(screen.getAllByText('Revision: Real payload exam focus').length).toBeGreaterThan(0);
    expect(screen.getByText('Ask Vidya for quick revision')).toBeTruthy();
  });

  it('opens mobile menu and profile sheets when buttons are clicked', () => {
    render(<Topbar />);

    const menuBtn = screen.getByTestId('mobile-menu-button');
    fireEvent.click(menuBtn);
    expect(screen.getByTestId('mobile-menu-sheet')).toBeTruthy();

    const profileBtn = screen.getByTestId('mobile-profile-button');
    fireEvent.click(profileBtn);
    expect(screen.getByTestId('mobile-profile-sheet')).toBeTruthy();
  });

  it('opens streak widget and returns focus to opener on Escape key', () => {
    render(<Topbar />);

    const streakBtn = screen.getByLabelText('5-day learning consistency - open details');
    fireEvent.click(streakBtn);

    // Popover should render with role=dialog or label
    expect(screen.getByLabelText(/Streak details|Loading streak/)).toBeTruthy();

    // Close via Escape key and assert focus returns to opener
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(document.activeElement).toBe(streakBtn);
  });
});
