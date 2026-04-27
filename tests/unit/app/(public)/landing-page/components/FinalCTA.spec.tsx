/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for FinalCTA landing page component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FinalCTA.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:55:00Z | copilot | add FinalCTA coverage for heading and CTA link
 * - 2026-04-27T14:30:00Z | copilot | LP-9.1: update assertions for new title, subtitle, and CTA label
 */
import { render, screen } from '@testing-library/react';
import FinalCTA from '@/app/(public)/landing-page/components/FinalCTA';

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

describe('FinalCTA', () => {
  it('should render LP-9.1 heading and subtitle content', () => {
    render(<FinalCTA />);

    expect(screen.getByText("Ready to transform your child's learning?")).toBeTruthy();
    expect(
      screen.getByText("Join 10,000+ Indian parents who've switched to smarter tutoring.")
    ).toBeTruthy();
  });

  it('should render primary CTA link to register', () => {
    render(<FinalCTA />);

    const cta = screen.getByRole('link', {
      name: /Start Free -- Sign in with Google/i,
    }) as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('https://app.spinzyacademy.com/register');
  });
});
