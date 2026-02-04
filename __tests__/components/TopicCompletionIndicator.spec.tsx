/**
 * FILE OBJECTIVE:
 * - Unit tests for TopicCompletionIndicator component.
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
import TopicCompletionIndicator, {
  getCompletionStatus,
  CompletionStatus,
} from '@/components/TopicCompletionIndicator';

describe('TopicCompletionIndicator', () => {
  it('renders not-started status', () => {
    render(<TopicCompletionIndicator status="not-started" />);
    // Check for empty circle (no checkmark)
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders in-progress status', () => {
    render(<TopicCompletionIndicator status="in-progress" progress={50} />);
    // Should have SVG progress ring
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders completed status with checkmark', () => {
    render(<TopicCompletionIndicator status="completed" />);
    // Should have SVG checkmark
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows tooltip by default', () => {
    render(<TopicCompletionIndicator status="completed" />);
    const indicator = document.querySelector('[title="Completed"]');
    expect(indicator).toBeInTheDocument();
  });

  it('hides tooltip when showTooltip is false', () => {
    render(<TopicCompletionIndicator status="completed" showTooltip={false} />);
    const indicator = document.querySelector('[title]');
    expect(indicator).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TopicCompletionIndicator status="completed" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  describe('size variants', () => {
    it('renders small size', () => {
      const { container } = render(
        <TopicCompletionIndicator status="completed" size="sm" />
      );
      expect(container.firstChild).toHaveClass('w-4', 'h-4');
    });

    it('renders medium size (default)', () => {
      const { container } = render(
        <TopicCompletionIndicator status="completed" />
      );
      expect(container.firstChild).toHaveClass('w-5', 'h-5');
    });

    it('renders large size', () => {
      const { container } = render(
        <TopicCompletionIndicator status="completed" size="lg" />
      );
      expect(container.firstChild).toHaveClass('w-6', 'h-6');
    });
  });
});

describe('getCompletionStatus', () => {
  it('returns completed when isCompleted is true', () => {
    expect(getCompletionStatus(true, false, 0)).toBe('completed');
  });

  it('returns in-progress when isStarted is true', () => {
    expect(getCompletionStatus(false, true, 0)).toBe('in-progress');
  });

  it('returns in-progress when questionsAttempted > 0', () => {
    expect(getCompletionStatus(false, false, 5)).toBe('in-progress');
  });

  it('returns not-started when nothing done', () => {
    expect(getCompletionStatus(false, false, 0)).toBe('not-started');
  });

  it('returns not-started when all params undefined', () => {
    expect(getCompletionStatus(undefined, undefined, undefined)).toBe('not-started');
  });
});
