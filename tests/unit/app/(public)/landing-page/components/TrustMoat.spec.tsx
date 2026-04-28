/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for the LP-3.1 trust moat cards, preview image, and internal link.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/TrustMoat.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created tests for trust moat image preview and card content
 */

import { render, screen } from '@testing-library/react';
import TrustMoat from '@/app/(public)/landing-page/components/TrustMoat';

jest.mock('next/image', () => {
  const MockImage = ({ alt, ...rest }: any) => <img alt={alt} {...rest} />;
  MockImage.displayName = 'NextImage';
  return MockImage;
});

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

describe('TrustMoat', () => {
  it('should render all four trust cards', () => {
    render(<TrustMoat />);

    expect(screen.getByText('DPDP Compliant')).toBeTruthy();
    expect(screen.getByText('No Tracking')).toBeTruthy();
    expect(screen.getByText('No Social Features')).toBeTruthy();
    expect(screen.getByText('Data Stays in India')).toBeTruthy();
  });

  it('should render the parent dashboard preview image and controls link', () => {
    render(<TrustMoat />);

    expect(
      screen.getByAltText(
        'Parent dashboard preview showing weak topics, screen time toggle, and subject blocker controls'
      )
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn more about Parent Controls →' })).toBeTruthy();
  });
});
