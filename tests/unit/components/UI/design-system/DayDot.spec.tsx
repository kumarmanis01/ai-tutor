import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('lucide-react', () => ({
  Check: ({ className, ...props }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} {...props} />
  ),
}));

import { DayDot } from '@/components/UI/design-system/DayDot';

describe('DayDot', () => {
  it.each([['done'], ['today'], ['future'], ['missed']] as const)(
    'renders state %s without crash',
    (state) => {
      render(<DayDot state={state} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    },
  );

  it('uses ariaLabel when provided', () => {
    render(<DayDot state="done" ariaLabel="Monday done" />);
    expect(screen.getByRole('img', { name: 'Monday done' })).toBeInTheDocument();
  });

  it('falls back to state as aria-label', () => {
    render(<DayDot state="today" />);
    expect(screen.getByRole('img', { name: 'today' })).toBeInTheDocument();
  });

  it('renders check icon for done state', () => {
    render(<DayDot state="done" />);
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });
});
