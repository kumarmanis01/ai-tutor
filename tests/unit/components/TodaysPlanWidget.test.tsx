/**
 * FILE OBJECTIVE:
 * - Unit tests for TodaysPlanWidget: skeleton while loading, empty state,
 *   and populated plan rendering.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock SWR so we can control loading/error/data states in tests
const mockUseSWR = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

// Mock design system components used by TodaysPlanWidget
jest.mock('@/components/UI/design-system/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
}));
jest.mock('@/components/UI/design-system/Pill', () => ({
  Pill: ({ children }: { children: React.ReactNode }) => <span data-testid="pill">{children}</span>,
}));
jest.mock('@/components/UI/design-system/SubjectChip', () => ({
  SubjectGlyph: () => <span data-testid="subject-glyph" />,
}));

import TodaysPlanWidget from '@/components/dashboard/TodaysPlanWidget';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fakePlan = [
  {
    topicSlug: 'quadratic-equations',
    subject: 'Mathematics',
    grade: '10',
    board: 'cbse',
    state: 'DEVELOPING',
    score: 0.6,
    lastStudiedAt: null,
    suggestedDifficulty: 5,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodaysPlanWidget', () => {
  beforeEach(() => mockUseSWR.mockReset());

  it('should render skeleton while loading', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true });
    const { container } = render(<TodaysPlanWidget />);
    // Skeleton is rendered via aria-hidden divs; check the card renders
    expect(container.querySelector('[data-testid="card"]')).toBeInTheDocument();
    // Topic links should not be rendered yet
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should render empty state with CTA when plan is empty', () => {
    mockUseSWR.mockReturnValue({
      data: { plan: [], cached: false },
      error: undefined,
      isLoading: false,
    });
    render(<TodaysPlanWidget />);
    expect(screen.getByText(/No topics yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find a test/i })).toBeInTheDocument();
  });

  it('should render topic rows when plan has items', () => {
    mockUseSWR.mockReturnValue({
      data: { plan: fakePlan, cached: true },
      error: undefined,
      isLoading: false,
    });
    render(<TodaysPlanWidget />);
    // slug is capitalised and dashes removed
    expect(screen.getByText('quadratic equations')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByTestId('subject-glyph')).toBeInTheDocument();
    // Continue pill for DEVELOPING state
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });
});
