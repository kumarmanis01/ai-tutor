/**
 * FILE OBJECTIVE:
 * - Unit tests for the public landing page hero section.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/hero-section.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add hero coverage for existing landing page theme class usage
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import HeroSection from '@/app/(public)/landing-page/components/HeroSection';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/UI/AppImage', () => ({
  __esModule: true,
  default: ({ alt, className }: { alt: string; className?: string }) => (
    <img alt={alt} className={className} />
  ),
}));

jest.mock('@/components/UI/AppIcon', () => ({
  __esModule: true,
  default: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} />
  ),
}));

describe('HeroSection', () => {
  it('renders using the existing landing page theme classes and CTA actions', () => {
    const querySelectorSpy = jest.spyOn(document, 'querySelector').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as Element);

    const { container } = render(<HeroSection />);

    const section = container.querySelector('section');
    expect(section).toHaveClass('from-brand-primary-bg', 'via-background', 'to-brand-success-bg/30');

    expect(screen.getByText('Trusted by 1 Lakh+ Indian families')).toBeInTheDocument();
    expect(screen.getByText('Learning support built for Indian families')).toHaveClass('text-brand-primary');

    const primaryCta = screen.getByRole('link', { name: /start for free/i });
    expect(primaryCta).toHaveClass('bg-brand-primary');

    const secondaryCta = screen.getByRole('button', { name: /see how it works/i });
    fireEvent.click(secondaryCta);
    expect(querySelectorSpy).toHaveBeenCalledWith('#how-it-works');

    querySelectorSpy.mockRestore();
  });
});