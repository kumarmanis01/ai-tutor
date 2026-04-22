/** @jest-environment jsdom */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FullScreenLoader } from '@/components/UI/loaders/FullScreenLoader';

describe('FullScreenLoader', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  it('should not render when visible is false', () => {
    render(<FullScreenLoader visible={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when visible is true', () => {
    render(<FullScreenLoader visible />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display the message prop', () => {
    render(<FullScreenLoader visible message="Loading your lesson..." />);
    expect(screen.getByText('Loading your lesson...')).toBeInTheDocument();
  });

  it('should use message as aria-label when provided', () => {
    render(<FullScreenLoader visible message="Preparing Vidya..." />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Preparing Vidya...');
  });

  it('should have default aria-label when no message', () => {
    render(<FullScreenLoader visible />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Loading, please wait');
  });

  it('should have aria-busy true when visible', () => {
    render(<FullScreenLoader visible />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  });

  it('should have aria-modal true when visible', () => {
    render(<FullScreenLoader visible />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('should remain visible during minimum display time after hide', () => {
    const { rerender } = render(<FullScreenLoader visible minimumDisplayTime={500} />);
    rerender(<FullScreenLoader visible={false} minimumDisplayTime={500} />);
    // Should still be in DOM before minimum time passes
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should be removed from DOM after minimum display time and fade-out', () => {
    const { rerender } = render(<FullScreenLoader visible minimumDisplayTime={300} />);
    rerender(<FullScreenLoader visible={false} minimumDisplayTime={300} />);
    act(() => { jest.advanceTimersByTime(300 + 260 + 10); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render dots variant by default', () => {
    render(<FullScreenLoader visible />);
    // Dots loader contains 3 span elements (the dots)
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('should render spinner variant', () => {
    render(<FullScreenLoader visible variant="spinner" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should render book variant', () => {
    render(<FullScreenLoader visible variant="book" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('svg')).toBeInTheDocument();
  });

  it('should render progress variant with progress value', () => {
    render(<FullScreenLoader visible variant="progress" progress={60} showProgress />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });
});
