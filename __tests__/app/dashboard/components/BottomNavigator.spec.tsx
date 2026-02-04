/**
 * FILE OBJECTIVE:
 * - Unit tests for BottomNavigator with new 5-tab IA.
 * - Tests tab rendering, selection, and callbacks.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/dashboard/components/BottomNavigator.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created/updated for new 5-tab IA with doubts
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomNavigation from '@/app/dashboard/components/BottomNavigator';
import type { TabId } from '@/app/dashboard/components/BottomNavigator';

describe('BottomNavigation', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 5 navigation tabs', () => {
    render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(screen.getByText('Doubts')).toBeInTheDocument();
    expect(screen.getByText('Me')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<BottomNavigation activeTab="notes" onTabChange={mockOnTabChange} />);

    const notesButton = screen.getByText('Notes').closest('button');
    expect(notesButton?.querySelector('.text-primary')).toBeInTheDocument();
  });

  it('calls onTabChange when a tab is clicked', () => {
    render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />);

    fireEvent.click(screen.getByText('Practice'));
    expect(mockOnTabChange).toHaveBeenCalledWith('tests');
  });

  it('calls onTabChange with "doubts" when Doubts tab is clicked', () => {
    render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />);

    fireEvent.click(screen.getByText('Doubts'));
    expect(mockOnTabChange).toHaveBeenCalledWith('doubts');
  });

  it('has proper aria-labels on buttons', () => {
    render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />);

    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Practice')).toBeInTheDocument();
    expect(screen.getByLabelText('Doubts')).toBeInTheDocument();
    expect(screen.getByLabelText('Me')).toBeInTheDocument();
  });

  it('marks active tab with aria-current', () => {
    render(<BottomNavigation activeTab="doubts" onTabChange={mockOnTabChange} />);

    const doubtsButton = screen.getByLabelText('Doubts');
    expect(doubtsButton).toHaveAttribute('aria-current', 'page');
  });

  it('renders in a nav element', () => {
    render(<BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('uses grid layout with 5 columns', () => {
    const { container } = render(
      <BottomNavigation activeTab="home" onTabChange={mockOnTabChange} />
    );

    const grid = container.querySelector('.grid-cols-5');
    expect(grid).toBeInTheDocument();
  });
});
