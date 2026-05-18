import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Card } from '@/components/UI/design-system/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it.each([['default'], ['warm'], ['hero']] as const)(
    'renders variant %s without crash',
    (variant) => {
      render(<Card variant={variant}>card</Card>);
      expect(screen.getByText('card')).toBeInTheDocument();
    },
  );

  it.each([['compact'], ['normal'], ['hero']] as const)(
    'renders padding %s without crash',
    (padding) => {
      render(<Card padding={padding}>card</Card>);
      expect(screen.getByText('card')).toBeInTheDocument();
    },
  );

  it('renders as section element when as="section"', () => {
    render(<Card as="section">sec</Card>);
    expect(screen.getByText('sec').tagName).toBe('SECTION');
  });

  it('passes extra className', () => {
    render(<Card className="extra-class">c</Card>);
    expect(screen.getByText('c')).toHaveClass('extra-class');
  });
});
