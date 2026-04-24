/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for the legacy compatibility wrapper at
 *   `context/GlobalLoaderProvider.tsx`.
 * - Verifies the legacy `useGlobalLoader()` API exists and preserves
 *   ref-counting semantics (overlapping start/stop calls).
 *
 * LINKED UNIT TEST:
 * - tests/unit/context/GlobalLoaderProvider.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | copilot | add compatibility tests for legacy loader API
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GlobalLoaderProvider, useGlobalLoader } from '@/context/GlobalLoaderProvider';
import { useGlobalLoader as useCanonicalGlobalLoader } from '@/components/UI/loaders';

function TestConsumer() {
  const { startLoading, stopLoading } = useGlobalLoader();
  const canonical = useCanonicalGlobalLoader();
  return (
    <>
      <button onClick={() => startLoading('testing')}>start</button>
      <button onClick={() => stopLoading()}>stop</button>
      <div data-testid="canonical-visible">{String(canonical.loaderState.visible)}</div>
    </>
  );
}

describe('GlobalLoaderProvider (legacy compatibility)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  it('exposes legacy API and shows the full-screen loader when startLoading is called', () => {
    render(
      <GlobalLoaderProvider>
        <TestConsumer />
      </GlobalLoaderProvider>
    );

    const startBtn = screen.getByText('start');
    act(() => { startBtn.click(); });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('preserves ref-counting across overlapping start/stop calls', () => {
    render(
      <GlobalLoaderProvider>
        <TestConsumer />
      </GlobalLoaderProvider>
    );

    const startBtn = screen.getByText('start');
    const stopBtn = screen.getByText('stop');

    act(() => { startBtn.click(); startBtn.click(); });

    // One stop should not hide the loader because there is still one active
    act(() => { stopBtn.click(); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Second stop should hide the loader (canonical provider visible -> false)
    act(() => { stopBtn.click(); jest.advanceTimersByTime(1000); });
    expect(screen.getByTestId('canonical-visible').textContent).toBe('false');
  });
});
