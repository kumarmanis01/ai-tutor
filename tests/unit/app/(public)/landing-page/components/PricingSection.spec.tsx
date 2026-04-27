/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for PricingSection billing toggle and CTA rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/PricingSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:56:00Z | copilot | add pricing toggle coverage for annual/monthly states
 */
import { fireEvent, render, screen } from '@testing-library/react';
import PricingSection from '@/app/(public)/landing-page/components/PricingSection';

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

describe('PricingSection', () => {
  it('should render annual plan by default', () => {
    render(<PricingSection />);

    expect(screen.getAllByText('Best Value').length).toBeGreaterThan(0);
    expect(screen.getByText('₹8,999')).toBeTruthy();
  });

  it('should switch to monthly pricing when monthly toggle is clicked', () => {
    render(<PricingSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));

    expect(screen.getByText('₹999')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Get started -- it takes 2 minutes/i })).toBeTruthy();
  });
});
