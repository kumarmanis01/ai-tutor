/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for landing page Footer component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/Footer.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:55:00Z | copilot | add footer coverage for key links and social anchors
 * - 2026-04-27T14:30:00Z | copilot | LP-9.1: assert product links, demo button, and social labels
 * - 2026-04-27T15:00:00Z | copilot | fix(review): update WhatsApp aria-label assertion to match new label
 */
import { render, screen } from '@testing-library/react';
import Footer from '@/app/(public)/landing-page/components/Footer';

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

describe('Footer', () => {
  it('should render product navigation links', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'How It Works' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Features' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Demo' })).toBeTruthy();
  });

  it('should render social links including WhatsApp, Instagram, YouTube and LinkedIn', () => {
    render(<Footer />);

    expect(screen.getByLabelText('Chat with Spinzy Academy on WhatsApp')).toBeTruthy();
    expect(screen.getByLabelText('Follow Spinzy Academy on Instagram')).toBeTruthy();
    expect(screen.getByLabelText('Watch Spinzy Academy on YouTube')).toBeTruthy();
    expect(screen.getByLabelText('Follow Spinzy Academy on LinkedIn')).toBeTruthy();
  });
});
