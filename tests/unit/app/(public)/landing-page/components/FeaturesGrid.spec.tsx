/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for FeaturesGrid rendering and core feature cards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FeaturesGrid.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:56:00Z | copilot | add coverage for FeaturesGrid headings and items
 */
import { render, screen } from '@testing-library/react';
import FeaturesGrid from '@/app/(public)/landing-page/components/FeaturesGrid';

describe('FeaturesGrid', () => {
  beforeAll(() => {
    (global as any).IntersectionObserver = class {
      callback: any;
      constructor(callback: any) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
      unobserve() {}
    };
  });

  it('should render section headings', () => {
    render(<FeaturesGrid />);

    expect(screen.getByText('Everything a Student Needs to Score Higher')).toBeTruthy();
    expect(screen.getByText('बेहतर अंक के लिए हर जरूरी चीज')).toBeTruthy();
  });

  it('should render key feature cards', () => {
    render(<FeaturesGrid />);

    expect(screen.getByText('Socratic AI Tutor')).toBeTruthy();
    expect(screen.getByText('DPDP Compliant')).toBeTruthy();
  });
});
