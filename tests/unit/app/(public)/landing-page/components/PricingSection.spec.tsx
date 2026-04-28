/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for PricingSection plan comparison, monthly/yearly toggle, and CTA rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/PricingSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:56:00Z | copilot | add pricing toggle coverage for annual/monthly states
 * - 2026-04-27T14:30:00Z | copilot | LP-6.2: assert annual savings comparison visibility by billing cycle
 * - 2026-04-28T00:00:00Z | copilot | LP-6.1: update assertions for Free, Individual, and Family comparison layout
 */
import { fireEvent, render, screen } from '@testing-library/react';
import PricingSection from '@/app/(public)/landing-page/components/PricingSection';

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

jest.mock('@/app/(public)/landing-page/components/LandingGoogleCtaButton', () => {
  const MockCta = ({ label }: { label: string }) => <button type="button">{label}</button>;
  MockCta.displayName = 'LandingGoogleCtaButton';
  return MockCta;
});

describe('PricingSection', () => {
  it('should render Free, Individual, and Family plans by default', () => {
    render(<PricingSection />);

    expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Individual' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Family' })).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Best Value')).toBeTruthy();
    expect(screen.getByText('Feature comparison')).toBeTruthy();
  });

  it('should switch to yearly pricing and show savings comparison', () => {
    render(<PricingSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));

    expect(screen.getByText('₹3,999')).toBeTruthy();
    expect(screen.getByText('₹5,999')).toBeTruthy();
    expect(screen.getByText('Save ₹21,001/year vs private tutoring')).toBeTruthy();
  });

  it('should include highlighted premium features and trust signals', () => {
    render(<PricingSection />);

    expect(screen.getByText('On-Demand Topic Generation')).toBeTruthy();
    expect(screen.getByText('Parent Dashboard')).toBeTruthy();
    expect(
      screen.getByText(
        '🔒 Secure checkout · UPI / Cards / Net Banking · 7-day refund policy · No auto-renewal without reminder'
      )
    ).toBeTruthy();
  });
});
