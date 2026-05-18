import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '@/components/UI/design-system/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it.each([['primary'], ['amber'], ['ghost'], ['danger']] as const)(
    'renders variant %s without crash',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );

  it('is disabled when variant is disabled', () => {
    render(<Button variant="disabled">Locked</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick handler', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled prop is set', () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies w-full when fullWidth is true', () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it.each([['sm'], ['md'], ['lg']] as const)(
    'renders size %s without crash',
    (size) => {
      render(<Button size={size}>btn</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );
});
