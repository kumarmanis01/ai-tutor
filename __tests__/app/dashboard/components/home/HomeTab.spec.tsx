/**
 * FILE OBJECTIVE:
 * - Unit tests for HomeTab component.
 * - Tests composition of home section components.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/dashboard/components/home/HomeTab.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created HomeTab unit tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomeTab } from '@/app/dashboard/components/home/HomeTab';

// Mock child components
jest.mock('@/app/dashboard/components/home/StudentGreeting', () => ({
  StudentGreeting: () => <div data-testid="student-greeting">Mock Greeting</div>,
}));

jest.mock('@/app/dashboard/components/home/TodaysLearningCard', () => ({
  TodaysLearningCard: ({ onStartLearning }: { onStartLearning?: (id: string) => void }) => (
    <div data-testid="todays-learning" onClick={() => onStartLearning?.('test-topic')}>
      Mock TodaysLearning
    </div>
  ),
}));

jest.mock('@/app/dashboard/components/home/ContinueWhereLeftOff', () => ({
  ContinueWhereLeftOff: ({ onContinueActivity }: { onContinueActivity?: (id: string, type: string) => void }) => (
    <div data-testid="continue-learning" onClick={() => onContinueActivity?.('test-activity', 'note')}>
      Mock ContinueWhereLeftOff
    </div>
  ),
}));

jest.mock('@/app/dashboard/components/home/WeeklyProgressSnapshot', () => ({
  WeeklyProgressSnapshot: () => <div data-testid="weekly-progress">Mock WeeklyProgress</div>,
}));

describe('HomeTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all home section components', () => {
    render(<HomeTab />);

    expect(screen.getByTestId('student-greeting')).toBeInTheDocument();
    expect(screen.getByTestId('todays-learning')).toBeInTheDocument();
    expect(screen.getByTestId('continue-learning')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-progress')).toBeInTheDocument();
  });

  it('renders encouraging footer message', () => {
    render(<HomeTab />);

    expect(screen.getByText(/Every step you take makes you smarter/i)).toBeInTheDocument();
  });

  it('has proper accessibility sections', () => {
    render(<HomeTab />);

    // Sections should have proper aria labeling
    const sections = screen.getAllByRole('region', { hidden: true });
    expect(sections.length).toBeGreaterThan(0);
  });

  it('calls onStartLearning callback when TodaysLearningCard is clicked', () => {
    const mockOnStartLearning = jest.fn();
    render(<HomeTab onStartLearning={mockOnStartLearning} />);

    screen.getByTestId('todays-learning').click();
    expect(mockOnStartLearning).toHaveBeenCalledWith('test-topic');
  });

  it('calls onContinueActivity callback when ContinueWhereLeftOff is clicked', () => {
    const mockOnContinueActivity = jest.fn();
    render(<HomeTab onContinueActivity={mockOnContinueActivity} />);

    screen.getByTestId('continue-learning').click();
    expect(mockOnContinueActivity).toHaveBeenCalledWith('test-activity', 'note');
  });
});
