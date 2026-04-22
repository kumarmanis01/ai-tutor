/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for useLoading hook: start/stop, minimum display time,
 *   withLoading promise wrapping, progress clamping, and timer cleanup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/useLoading.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | claude | created for global loader system
 */

import { renderHook, act } from '@testing-library/react';
import { useLoading } from '@/components/UI/loaders/useLoading';

describe('useLoading', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  it('should start in non-loading state', () => {
    const { result } = renderHook(() => useLoading());
    expect(result.current.isLoading).toBe(false);
  });

  it('should set isLoading to true when startLoading is called', () => {
    const { result } = renderHook(() => useLoading());
    act(() => { result.current.startLoading(); });
    expect(result.current.isLoading).toBe(true);
  });

  it('should stop loading immediately when elapsed time exceeds minimum', () => {
    const { result } = renderHook(() => useLoading(100));
    act(() => { result.current.startLoading(); });
    act(() => { jest.advanceTimersByTime(200); });
    act(() => { result.current.stopLoading(); });
    expect(result.current.isLoading).toBe(false);
  });

  it('should not stop loading before minimum display time elapses', () => {
    const { result } = renderHook(() => useLoading(500));
    act(() => { result.current.startLoading(); });
    act(() => { result.current.stopLoading(); });
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current.isLoading).toBe(true);
  });

  it('should stop loading after minimum display time when called early', () => {
    const { result } = renderHook(() => useLoading(500));
    act(() => { result.current.startLoading(); });
    act(() => {
      result.current.stopLoading();
      jest.advanceTimersByTime(500);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle withLoading wrapping a resolved promise', async () => {
    const { result } = renderHook(() => useLoading(0));
    let resolved: string | undefined;
    await act(async () => {
      resolved = await result.current.withLoading(Promise.resolve('data'));
    });
    expect(resolved).toBe('data');
    expect(result.current.isLoading).toBe(false);
  });

  it('should stop loading even when promise rejects', async () => {
    const { result } = renderHook(() => useLoading(0));
    await act(async () => {
      await result.current.withLoading(Promise.reject(new Error('fail'))).catch(() => undefined);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('should start at progress 0', () => {
    const { result } = renderHook(() => useLoading());
    expect(result.current.progress).toBe(0);
  });

  it('should update progress value', () => {
    const { result } = renderHook(() => useLoading());
    act(() => { result.current.setProgress(50); });
    expect(result.current.progress).toBe(50);
  });

  it('should clamp progress to 0 when below 0', () => {
    const { result } = renderHook(() => useLoading());
    act(() => { result.current.setProgress(-10); });
    expect(result.current.progress).toBe(0);
  });

  it('should clamp progress to 100 when above 100', () => {
    const { result } = renderHook(() => useLoading());
    act(() => { result.current.setProgress(150); });
    expect(result.current.progress).toBe(100);
  });

  it('should cancel pending stop timer when startLoading is called again', () => {
    const { result } = renderHook(() => useLoading(500));
    act(() => { result.current.startLoading(); });
    act(() => { result.current.stopLoading(); });
    // Call startLoading again before the stop timer fires
    act(() => { result.current.startLoading(); });
    act(() => { jest.advanceTimersByTime(500); });
    // Should still be loading since we restarted
    expect(result.current.isLoading).toBe(true);
  });
});
