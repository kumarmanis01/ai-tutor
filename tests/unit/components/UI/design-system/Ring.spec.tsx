import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Ring } from '@/components/UI/design-system/Ring';

describe('Ring', () => {
  it('renders the ds-ring element', () => {
    const { container } = render(<Ring percent={50} />);
    expect(container.querySelector('.ds-ring')).toBeInTheDocument();
  });

  it.each([['sm'], ['md'], ['lg']] as const)(
    'renders size %s without crash',
    (size) => {
      const { container } = render(<Ring percent={50} size={size} />);
      expect(container.querySelector('.ds-ring')).toBeInTheDocument();
    },
  );

  it('renders children inside the ring', () => {
    render(<Ring percent={75}>Strong</Ring>);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('renders with ariaLabel', () => {
    render(<Ring percent={30} ariaLabel="Math readiness: Weak" />);
    expect(screen.getByRole('img', { name: 'Math readiness: Weak' })).toBeInTheDocument();
  });

  it('clamps percent above 100', () => {
    const { container } = render(<Ring percent={150} />);
    const el = container.querySelector('.ds-ring') as HTMLElement;
    expect(el.style.getPropertyValue('--ring-percent')).toBe('100');
  });

  it('clamps percent below 0', () => {
    const { container } = render(<Ring percent={-10} />);
    const el = container.querySelector('.ds-ring') as HTMLElement;
    expect(el.style.getPropertyValue('--ring-percent')).toBe('0');
  });
});
