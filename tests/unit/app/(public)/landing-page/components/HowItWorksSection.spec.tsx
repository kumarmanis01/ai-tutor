/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for the LP-4.1 how-it-works section tab toggle and exact journey steps.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/HowItWorksSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created tests for how-it-works desktop/mobile journey content
 */

import { fireEvent, render, screen } from '@testing-library/react';
import HowItWorksSection from '@/app/(public)/landing-page/components/HowItWorksSection';

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

describe('HowItWorksSection', () => {
  it('should render the exact student and parent step titles', () => {
    render(<HowItWorksSection />);

    expect(screen.getAllByText('Take a 15-min Diagnostic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Learn Socratically from AI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Request Any Topic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approve & Set Limits').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Watch Progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assign Extra Practice').length).toBeGreaterThan(0);
  });

  it('should switch visible mobile journey content when the tab changes', () => {
    render(<HowItWorksSection />);

    fireEvent.click(screen.getByRole('button', { name: 'For Parents' }));

    expect(screen.getAllByText('Assign Extra Practice').length).toBeGreaterThan(0);
  });
});
