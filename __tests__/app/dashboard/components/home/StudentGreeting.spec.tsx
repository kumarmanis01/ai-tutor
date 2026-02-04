/**
 * FILE OBJECTIVE:
 * - Unit tests for StudentGreeting component.
 * - Tests time-based greeting and profile display.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/dashboard/components/home/StudentGreeting.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created StudentGreeting unit tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StudentGreeting } from '@/app/dashboard/components/home/StudentGreeting';

// Mock useCurrentUser hook
jest.mock('@/hooks/useCurrentUser', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useCurrentUser from '@/hooks/useCurrentUser';

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

describe('StudentGreeting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock
    mockUseCurrentUser.mockReturnValue({
      data: { name: 'Aarav Sharma', grade: 8, board: 'CBSE' },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);
  });

  it('renders loading state', () => {
    mockUseCurrentUser.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<StudentGreeting />);

    // Should show skeleton loader
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('displays student first name', () => {
    render(<StudentGreeting />);

    expect(screen.getByText('Aarav')).toBeInTheDocument();
  });

  it('displays grade and board info', () => {
    render(<StudentGreeting />);

    expect(screen.getByText('Grade 8')).toBeInTheDocument();
    expect(screen.getByText('CBSE')).toBeInTheDocument();
  });

  it('shows "Student" as fallback when name is not available', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { name: null, grade: null, board: null },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<StudentGreeting />);

    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('hides grade/board section when not available', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { name: 'Test', grade: null, board: null },
      loading: false,
      error: null,
      mutate: jest.fn(),
    } as any);

    render(<StudentGreeting />);

    expect(screen.queryByText(/Grade/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CBSE/)).not.toBeInTheDocument();
  });

  it('includes appropriate greeting based on time', () => {
    render(<StudentGreeting />);

    // Should contain one of the greetings
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/Good (morning|afternoon|evening)/i);
  });

  it('renders wave emoji in greeting', () => {
    render(<StudentGreeting />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('👋');
  });
});
