/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for BoardSpecificSection tab switching behavior and CTA.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/BoardSpecificSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:55:00Z | copilot | add board tab switching coverage
 */
import { fireEvent, render, screen } from '@testing-library/react';
import BoardSpecificSection from '@/app/(public)/landing-page/components/BoardSpecificSection';

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

describe('BoardSpecificSection', () => {
  it('should render CBSE content by default', () => {
    render(<BoardSpecificSection />);

    expect(screen.getByText(/Central Board of Secondary Education/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CBSE' })).toBeTruthy();
  });

  it('should switch to ICSE content when ICSE tab is clicked', () => {
    render(<BoardSpecificSection />);

    fireEvent.click(screen.getByRole('button', { name: 'ICSE' }));

    expect(screen.getByText(/Indian Certificate of Secondary Education/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Start ICSE Prep Free/i })).toBeTruthy();
  });
});
