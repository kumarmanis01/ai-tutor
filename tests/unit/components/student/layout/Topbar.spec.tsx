/**
 * FILE OBJECTIVE:
 * - Unit tests for `Topbar` component: verifies logo, streak badge, and mobile sheet behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/layout/Topbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:10:00Z | staff-engineer | add Topbar unit tests for mobile sheets and badges
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-auth session
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Sam Student' } }, status: 'authenticated' }),
}));

// Mock SWR to return predictable topbar stats
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: { streak: 5, level: 3, shieldAvailable: true } }),
}));

import Topbar from '@/components/student/layout/Topbar';

describe('Topbar (component)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders logo and streak badge', () => {
    render(<Topbar />);

    expect(screen.getByLabelText('Spinzy home')).toBeInTheDocument();
    expect(screen.getByLabelText('5 day streak -- tap for details')).toBeInTheDocument();
    expect(screen.getByText(/Lv 3/)).toBeInTheDocument();
  });

  it('opens mobile menu and profile sheets when buttons clicked', () => {
    render(<Topbar />);

    const menuBtn = screen.getByTestId('mobile-menu-button');
    fireEvent.click(menuBtn);
    expect(screen.getByTestId('mobile-menu-sheet')).toBeInTheDocument();

    const profileBtn = screen.getByTestId('mobile-profile-button');
    fireEvent.click(profileBtn);
    expect(screen.getByTestId('mobile-profile-sheet')).toBeInTheDocument();
  });

  it('opens streak widget and returns focus to opener on Escape', () => {
    render(<Topbar />);

    const streakBtn = screen.getByLabelText('5 day streak -- tap for details');
    fireEvent.click(streakBtn);

    // Popover should render with role=dialog or label
    expect(screen.getByLabelText(/Streak details|Loading streak/)).toBeInTheDocument();

    // Close via Escape key and assert focus returns to opener
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(streakBtn).toHaveFocus();
  });
});
