import React from 'react';
import { render, screen } from '@testing-library/react';
import VisualHintRenderer from '@/components/student/session/VisualHintRenderer';

describe('VisualHintRenderer', () => {
  it('renders an SVG image when given JSON shapes', () => {
    const json = JSON.stringify({ shapes: [{ type: 'circle', cx: 50, cy: 30, r: 6, label: 'A' }] });
    render(<VisualHintRenderer hint={json} />);
    expect(screen.getByRole('img', { name: /Visual hint diagram/i })).toBeInTheDocument();
  });

  it('renders textual fallback for plain text hints', () => {
    render(<VisualHintRenderer hint={'draw a triangle with labels A B C'} />);
    expect(screen.getByText(/Visual hint/)).toBeInTheDocument();
    expect(screen.getByText(/draw a triangle with labels A B C/)).toBeInTheDocument();
  });
});
