/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for the LP-2.1 hero copy, trust badges, and CTA rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/HeroSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created tests for parent-permission hero content and CTA
 */

import { render, screen } from '@testing-library/react';
import HeroSection from '@/app/(public)/landing-page/components/HeroSection';

jest.mock('@/app/(public)/landing-page/components/VideoModal', () => {
  const MockVideoModal = () => null;
  MockVideoModal.displayName = 'VideoModal';
  return MockVideoModal;
});

jest.mock('@/app/(public)/landing-page/components/LandingGoogleCtaButton', () => {
  const MockCta = ({ label }: { label: string }) => <button type="button">{label}</button>;
  MockCta.displayName = 'LandingGoogleCtaButton';
  return MockCta;
});

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

describe('HeroSection', () => {
  it('should render the parent-permission headline and bilingual subcopy', () => {
    render(<HeroSection />);

    expect(screen.getByText('The AI Tutor That Asks YOUR Permission First')).toBeTruthy();
    expect(
      screen.getByText(
        'Spinzy Academy lets your child learn with an AI tutor while you control what they access, for how long, and what data is shared.'
      )
    ).toBeTruthy();
    expect(screen.getByText('AI Tutor जो पहले आपकी अनुमति लेता है')).toBeTruthy();
  });

  it('should render the required trust badges and google CTA label', () => {
    render(<HeroSection />);

    expect(screen.getByText('DPDP Compliant')).toBeTruthy();
    expect(screen.getByText('No Tracking')).toBeTruthy();
    expect(screen.getByText('No Social Features')).toBeTruthy();
    expect(screen.getByText('Servers in India')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Free -- Sign in with Google' })).toBeTruthy();
  });

  it('should render the 1 lakh social proof micro-element', () => {
    render(<HeroSection />);

    expect(screen.getByText('Trusted by 1 Lakh+ Indian families')).toBeTruthy();
  });
});
