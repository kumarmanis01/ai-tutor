/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for FAQSection rendering with FAQAccordion integration.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FAQSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T14:30:00Z | copilot | created FAQSection tests for LP-7.1 rendering and toggle
 */

import { fireEvent, render, screen } from '@testing-library/react';
import FAQSection from '@/app/(public)/landing-page/components/FAQSection';

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

describe('FAQSection', () => {
  it('should render section heading and keep answers collapsed initially', () => {
    render(<FAQSection />);

    expect(screen.getByText('Frequently Asked Questions')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /Can my child try before paying/i })
        .getAttribute('aria-expanded')
    ).toBe('false');
  });

  it('should expand answer on question click', () => {
    render(<FAQSection />);

    const trialQuestion = screen.getByRole('button', { name: /Can my child try before paying/i });

    fireEvent.click(trialQuestion);
    expect(trialQuestion.getAttribute('aria-expanded')).toBe('true');

    expect(
      screen.getByText(
        'Absolutely. Free tier includes 5 daily practice questions, full diagnostic quiz, and learning map preview. No credit card required. Upgrade anytime for unlimited access.'
      )
    ).toBeTruthy();
  });
});
