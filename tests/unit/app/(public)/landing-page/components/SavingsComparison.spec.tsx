/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for SavingsComparison LP-6.2 annual savings messaging and cost figures.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/SavingsComparison.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T14:30:00Z | copilot | created tests for LP-6.2 savings comparison section
 */

import { render, screen } from '@testing-library/react';
import SavingsComparison from '@/app/(public)/landing-page/components/SavingsComparison';

describe('SavingsComparison', () => {
  it('should render annual savings badge text', () => {
    render(<SavingsComparison />);

    expect(screen.getByText('Save ₹21,001/year vs private tutoring')).toBeTruthy();
  });

  it('should render tutoring and spinzy monthly comparison values', () => {
    render(<SavingsComparison />);

    expect(screen.getAllByText(/₹2,500/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹750/i).length).toBeGreaterThan(0);
  });
});
