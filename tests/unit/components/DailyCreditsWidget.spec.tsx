/**
 * FILE OBJECTIVE:
 * - JSX tests for DailyCreditsWidget -- rendering states, color changes,
 *   upgrade link visibility, and skeleton while loading.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial tests for task S1-3
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DailyCreditsContext, DailyCreditsWidget } from '@/components/UI/DailyCreditsWidget';

// Minimal next/link mock -- jsdom has no Next.js router.
jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const noop = () => {};

function renderWithCredits(
  creditsUsed: number,
  creditsLimit: number,
  isLoading: boolean,
) {
  return render(
    <DailyCreditsContext.Provider value={{ creditsUsed, creditsLimit, isLoading, handleMeta: noop }}>
      <DailyCreditsWidget />
    </DailyCreditsContext.Provider>,
  );
}

describe('DailyCreditsWidget', () => {
  it('should render skeleton before first meta event', () => {
    renderWithCredits(0, 50, true);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('credits-fraction')).not.toBeInTheDocument();
  });

  it('should render usage fraction when not loading', () => {
    renderWithCredits(43, 50, false);
    const fraction = screen.getByTestId('credits-fraction');
    expect(fraction).toHaveTextContent('43 / 50 today');
  });

  it('should show amber styling when at 80% of limit', () => {
    // 40 of 50 = 80%
    renderWithCredits(40, 50, false);
    const fraction = screen.getByTestId('credits-fraction');
    expect(fraction.className).toContain('text-warning');
  });

  it('should not show amber styling below 80% of limit', () => {
    // 39 of 50 = 78%
    renderWithCredits(39, 50, false);
    const fraction = screen.getByTestId('credits-fraction');
    expect(fraction.className).not.toContain('text-warning');
    expect(fraction.className).toContain('text-muted-foreground');
  });

  it('should show upgrade link when at limit', () => {
    renderWithCredits(50, 50, false);
    const link = screen.getByTestId('upgrade-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Upgrade for more');
    expect(link).toHaveAttribute('href', '/pricing');
  });

  it('should not show upgrade link when below limit', () => {
    renderWithCredits(30, 50, false);
    expect(screen.queryByTestId('upgrade-link')).not.toBeInTheDocument();
  });

  it('should show amber and upgrade link when creditsUsed exceeds limit', () => {
    renderWithCredits(51, 50, false);
    const fraction = screen.getByTestId('credits-fraction');
    expect(fraction.className).toContain('text-warning');
    expect(screen.getByTestId('upgrade-link')).toBeInTheDocument();
  });

  it('should show amber at 80% but no upgrade link yet', () => {
    // Exactly 80% -- near limit, not at limit
    renderWithCredits(160, 200, false);
    const fraction = screen.getByTestId('credits-fraction');
    expect(fraction.className).toContain('text-warning');
    expect(screen.queryByTestId('upgrade-link')).not.toBeInTheDocument();
  });
});
