import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NextActionCard from '@/components/home/NextActionCard';

describe('NextActionCard', () => {
  it('renders correct CTA text for actionType values', () => {
    const { rerender } = render(<NextActionCard topic="T" actionType="lesson" /> as any);
    expect(screen.getByRole('button', { name: /Continue Lesson/ })).toBeInTheDocument();

    rerender(<NextActionCard topic="T" actionType="practice" /> as any);
    expect(screen.getByRole('button', { name: /Practice Topic/ })).toBeInTheDocument();

    rerender(<NextActionCard topic="T" actionType="assignment" /> as any);
    expect(screen.getByRole('button', { name: /Open Assignment/ })).toBeInTheDocument();

    rerender(<NextActionCard topic="T" actionType={undefined as any} /> as any);
    expect(screen.getByRole('button', { name: /Start Lesson/ })).toBeInTheDocument();
  });

  it('shows Why tooltip with ruleId when focused', () => {
    render(
      <NextActionCard
        topic="T"
        ruleId="rule-123"
        reasonLabel="because"
        actionType="lesson"
      /> as any
    );

    const whyButton = screen.getByLabelText(/Why this\? rule/);
    fireEvent.focus(whyButton);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.getAttribute('aria-label')).toContain('rule:rule-123');
  });

  it('renders exactly one primary CTA button', () => {
    render(<NextActionCard topic="T" actionType="practice" /> as any);

    const primaryCTAs = screen.getAllByRole('button', { name: /Continue Lesson|Practice Topic|Open Assignment|Start Lesson/ });
    expect(primaryCTAs.length).toBe(1);
  });
});
