/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for FAQAccordion expand/collapse behavior and default collapsed state.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FAQAccordion.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T14:30:00Z | copilot | created tests for LP-7.1 FAQ accordion interactions
 */

import { fireEvent, render, screen } from '@testing-library/react';
import FAQAccordion from '@/app/(public)/landing-page/components/FAQAccordion';
import type { FAQ } from '@/app/(public)/landing-page/components/faq-data';

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

const ITEMS: FAQ[] = [
  {
    id: 1,
    questionEn: 'Question 1',
    questionHi: 'प्रश्न 1',
    answerEn: 'Answer 1',
    answerHi: 'उत्तर 1',
    category: 'General',
  },
  {
    id: 2,
    questionEn: 'Question 2',
    questionHi: 'प्रश्न 2',
    answerEn: 'Answer 2',
    answerHi: 'उत्तर 2',
    category: 'General',
  },
];

describe('FAQAccordion', () => {
  it('should keep all items collapsed initially', () => {
    render(<FAQAccordion items={ITEMS} />);

    expect(screen.getByRole('button', { name: /Question 1/i }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(screen.getByRole('button', { name: /Question 2/i }).getAttribute('aria-expanded')).toBe(
      'false'
    );
  });

  it('should expand on click and collapse when clicking the same question again', () => {
    render(<FAQAccordion items={ITEMS} />);

    const questionOne = screen.getByRole('button', { name: /Question 1/i });

    fireEvent.click(questionOne);
    expect(questionOne.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(questionOne);
    expect(questionOne.getAttribute('aria-expanded')).toBe('false');
  });

  it('should keep only one question open at a time', () => {
    render(<FAQAccordion items={ITEMS} />);

    const questionOne = screen.getByRole('button', { name: /Question 1/i });
    const questionTwo = screen.getByRole('button', { name: /Question 2/i });

    fireEvent.click(questionOne);
    expect(questionOne.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(questionTwo);
    expect(questionOne.getAttribute('aria-expanded')).toBe('false');
    expect(questionTwo.getAttribute('aria-expanded')).toBe('true');
  });
});
