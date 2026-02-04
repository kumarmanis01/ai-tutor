/**
 * FILE OBJECTIVE:
 * - Unit tests for ProgressBar component.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP progress indicators
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgressBar, { calculateProgress } from '@/components/ProgressBar';

describe('ProgressBar', () => {
  it('renders progress percentage', () => {
    render(<ProgressBar progress={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders progress label', () => {
    render(<ProgressBar progress={50} />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ProgressBar progress={50} showLabel={false} />);
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('clamps progress to 0-100 range', () => {
    const { rerender } = render(<ProgressBar progress={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();

    rerender(<ProgressBar progress={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('rounds progress to integer', () => {
    render(<ProgressBar progress={33.7} />);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProgressBar progress={50} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  describe('size variants', () => {
    it('renders small size', () => {
      const { container } = render(<ProgressBar progress={50} size="sm" />);
      const bar = container.querySelector('.bg-gray-200');
      expect(bar).toHaveClass('h-1.5');
    });

    it('renders medium size (default)', () => {
      const { container } = render(<ProgressBar progress={50} />);
      const bar = container.querySelector('.bg-gray-200');
      expect(bar).toHaveClass('h-2.5');
    });

    it('renders large size', () => {
      const { container } = render(<ProgressBar progress={50} size="lg" />);
      const bar = container.querySelector('.bg-gray-200');
      expect(bar).toHaveClass('h-4');
    });
  });

  describe('variant colors', () => {
    it('uses default indigo color', () => {
      const { container } = render(<ProgressBar progress={50} variant="default" />);
      const fill = container.querySelector('.bg-indigo-500');
      expect(fill).toBeInTheDocument();
    });

    it('uses success green color', () => {
      const { container } = render(<ProgressBar progress={50} variant="success" />);
      const fill = container.querySelector('.bg-green-500');
      expect(fill).toBeInTheDocument();
    });

    it('uses warning yellow color', () => {
      const { container } = render(<ProgressBar progress={50} variant="warning" />);
      const fill = container.querySelector('.bg-yellow-500');
      expect(fill).toBeInTheDocument();
    });

    it('uses info blue color', () => {
      const { container } = render(<ProgressBar progress={50} variant="info" />);
      const fill = container.querySelector('.bg-blue-500');
      expect(fill).toBeInTheDocument();
    });
  });

  describe('label positions', () => {
    it('shows label outside by default', () => {
      render(<ProgressBar progress={50} labelPosition="outside" />);
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('hides label when labelPosition is none', () => {
      render(<ProgressBar progress={50} labelPosition="none" showLabel={false} />);
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });
  });
});

describe('calculateProgress', () => {
  it('calculates correct percentage', () => {
    expect(calculateProgress(5, 10)).toBe(50);
    expect(calculateProgress(3, 12)).toBe(25);
    expect(calculateProgress(10, 10)).toBe(100);
  });

  it('returns 0 when total is 0', () => {
    expect(calculateProgress(5, 0)).toBe(0);
  });

  it('returns 0 when total is negative', () => {
    expect(calculateProgress(5, -10)).toBe(0);
  });

  it('handles completed = 0', () => {
    expect(calculateProgress(0, 10)).toBe(0);
  });
});
