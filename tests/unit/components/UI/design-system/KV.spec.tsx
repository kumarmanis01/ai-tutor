import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KV } from '@/components/UI/design-system/KV';

describe('KV', () => {
  it('renders label and value', () => {
    render(<KV label="Plan" value="Free" />);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders emptyHint when value is null', () => {
    render(<KV label="Email" value={null} emptyHint="Not provided" />);
    expect(screen.getByText('Not provided')).toBeInTheDocument();
  });

  it('renders default emptyHint for empty string', () => {
    render(<KV label="City" value="" />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('renders default emptyHint for undefined', () => {
    render(<KV label="City" value={undefined} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('renders ReactNode value', () => {
    render(<KV label="Tags" value={<span data-testid="tags">Math</span>} />);
    expect(screen.getByTestId('tags')).toBeInTheDocument();
  });

  it('omits bottom divider on last row', () => {
    const { container } = render(<KV label="X" value="Y" last />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain('border-b');
  });

  it('has bottom divider when not last', () => {
    const { container } = render(<KV label="X" value="Y" />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-b');
  });
});
