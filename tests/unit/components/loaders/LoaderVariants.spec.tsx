/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for all loader variant components: DotPulseLoader, SpinnerLoader,
 *   BookLoader, ProgressLoader (clamping + aria), and MascotLoader.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/LoaderVariants.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | claude | created for global loader system
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  DotPulseLoader,
  SpinnerLoader,
  BookLoader,
  ProgressLoader,
  MascotLoader,
} from '@/components/UI/loaders/LoaderVariants';

describe('DotPulseLoader', () => {
  it('should render without crash with default props', () => {
    render(<DotPulseLoader />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render small size variant', () => {
    render(<DotPulseLoader size="small" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render large size variant', () => {
    render(<DotPulseLoader size="large" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render with custom color', () => {
    render(<DotPulseLoader color="#FF0000" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render three dot spans', () => {
    const { container } = render(<DotPulseLoader />);
    expect(container.querySelectorAll('span').length).toBe(3);
  });
});

describe('SpinnerLoader', () => {
  it('should render without crash with default props', () => {
    render(<SpinnerLoader />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render small size variant', () => {
    render(<SpinnerLoader size="small" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render with custom color', () => {
    render(<SpinnerLoader color="#1D9E75" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });
});

describe('BookLoader', () => {
  it('should render without crash', () => {
    render(<BookLoader />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render SVG element', () => {
    const { container } = render(<BookLoader />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render with custom color', () => {
    render(<BookLoader color="#BA7517" />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });
});

describe('ProgressLoader', () => {
  it('should render with correct progress value', () => {
    render(<ProgressLoader progress={50} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('should clamp progress to 0 when below 0', () => {
    render(<ProgressLoader progress={-10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('should clamp progress to 100 when above 100', () => {
    render(<ProgressLoader progress={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('should show percentage text when showProgress is true', () => {
    render(<ProgressLoader progress={75} showProgress />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should not show percentage text by default', () => {
    render(<ProgressLoader progress={75} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<ProgressLoader progress={30} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});

describe('MascotLoader', () => {
  it('should render without crash', () => {
    render(<MascotLoader />);
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should render a tip message', () => {
    render(<MascotLoader />);
    expect(screen.getByRole('img', { name: 'Loading' }).nextSibling).toBeNull();
    // The tip paragraph should be present
    const { container } = render(<MascotLoader />);
    expect(container.querySelector('p')).toBeInTheDocument();
  });
});
