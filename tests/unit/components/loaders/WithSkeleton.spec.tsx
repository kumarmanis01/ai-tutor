/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for WithSkeleton HOC: shows skeleton while loading, respects
 *   minimum delay before revealing children, and handles rapid state flips.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/WithSkeleton.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | claude | created for global loader system
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WithSkeleton } from '@/components/UI/loaders/WithSkeleton';

describe('WithSkeleton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  it('should show skeleton when isLoading is true', () => {
    render(
      <WithSkeleton isLoading skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );
    expect(screen.getByText('Loading skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Actual content')).not.toBeInTheDocument();
  });

  it('should show children when isLoading is false initially', () => {
    render(
      <WithSkeleton isLoading={false} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );
    // isLoading=false from the start means showSkeleton starts false
    act(() => { jest.runAllTimers(); });
    expect(screen.getByText('Actual content')).toBeInTheDocument();
    expect(screen.queryByText('Loading skeleton')).not.toBeInTheDocument();
  });

  it('should transition from skeleton to content after delay elapses', () => {
    const { rerender } = render(
      <WithSkeleton isLoading delay={200} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );

    rerender(
      <WithSkeleton isLoading={false} delay={200} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );

    // Skeleton still showing before delay
    expect(screen.getByText('Loading skeleton')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(200); });

    expect(screen.getByText('Actual content')).toBeInTheDocument();
    expect(screen.queryByText('Loading skeleton')).not.toBeInTheDocument();
  });

  it('should keep showing skeleton when isLoading flips back to true', () => {
    const { rerender } = render(
      <WithSkeleton isLoading delay={200} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );

    rerender(
      <WithSkeleton isLoading={false} delay={200} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );

    // Before delay fires, flip back to loading
    rerender(
      <WithSkeleton isLoading delay={200} skeleton={<div>Loading skeleton</div>}>
        <div>Actual content</div>
      </WithSkeleton>,
    );

    act(() => { jest.advanceTimersByTime(400); });

    expect(screen.getByText('Loading skeleton')).toBeInTheDocument();
  });
});
