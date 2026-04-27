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
    expect(screen.getByRole('link', { name: 'FAQ' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Schools' })).toBeTruthy();
  });

  it('should render social links including WhatsApp, LinkedIn, and Twitter/X', () => {
    render(<Footer />);

    expect(screen.getByLabelText('Chat with Spinzy Academy on WhatsApp')).toBeTruthy();
    expect(screen.getByLabelText('Follow Spinzy Academy on LinkedIn')).toBeTruthy();
    expect(screen.getByLabelText('Follow Spinzy Academy on Twitter / X')).toBeTruthy();
  });
});
