/**
 * FILE OBJECTIVE:
 * - Unit tests for TodaysLearningCard component.
 * - Tests recommendation display and start learning action.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/dashboard/components/home/TodaysLearningCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created TodaysLearningCard unit tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodaysLearningCard } from '@/app/dashboard/components/home/TodaysLearningCard';

// Mock useRecommendations hook
jest.mock('@/hooks/useRecommendations', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useRecommendations from '@/hooks/useRecommendations';

const mockUseRecommendations = useRecommendations as jest.MockedFunction<typeof useRecommendations>;

describe('TodaysLearningCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseRecommendations.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<TodaysLearningCard />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no recommendations', () => {
    mockUseRecommendations.mockReturnValue({
      data: { items: [] },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<TodaysLearningCard />);

    expect(screen.getByText(/nothing scheduled/i)).toBeInTheDocument();
  });

  it('displays topic recommendation details', () => {
    mockUseRecommendations.mockReturnValue({
      data: {
        items: [{
          id: 'topic-1',
          title: 'Fractions',
          subject: 'Math',
          estimatedMinutes: 15,
          type: 'topic',
        }],
      },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<TodaysLearningCard />);

    expect(screen.getByText('Fractions')).toBeInTheDocument();
    expect(screen.getByText(/Math/)).toBeInTheDocument();
    expect(screen.getByText(/15 min/)).toBeInTheDocument();
  });

  it('calls onStartLearning when button is clicked', () => {
    const mockOnStartLearning = jest.fn();
    mockUseRecommendations.mockReturnValue({
      data: {
        items: [{
          id: 'topic-1',
          title: 'Fractions',
          subject: 'Math',
          estimatedMinutes: 15,
          type: 'topic',
        }],
      },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<TodaysLearningCard onStartLearning={mockOnStartLearning} />);

    const startButton = screen.getByText(/Start Learning/i);
    fireEvent.click(startButton);

    expect(mockOnStartLearning).toHaveBeenCalledWith('topic-1');
  });

  it('renders heading with correct text', () => {
    mockUseRecommendations.mockReturnValue({
      data: {
        items: [{
          id: 'topic-1',
          title: 'Test Topic',
          subject: 'Test',
          estimatedMinutes: 10,
          type: 'topic',
        }],
      },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<TodaysLearningCard />);

    expect(screen.getByText("Today's Learning")).toBeInTheDocument();
  });
});
