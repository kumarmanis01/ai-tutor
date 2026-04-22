/**
 * FILE OBJECTIVE:
 * - Custom React hook for managing loading state with a configurable minimum
 *   display time to prevent flashing on fast responses.
 * - Exposes start/stop helpers, a promise-wrapping utility, and a progress value.
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

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UseLoadingReturn } from './types';

export function useLoading(minimumDisplayTime = 300): UseLoadingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgressState] = useState(0);
  const showTimeRef = useRef<number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const startLoading = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    showTimeRef.current = Date.now();
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    // Always cancel any in-flight stop timer before scheduling a new one,
    // preventing multiple calls from stacking up deferred setIsLoading(false).
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (showTimeRef.current === null) {
      setIsLoading(false);
      return;
    }
    const elapsed = Date.now() - showTimeRef.current;
    const remaining = minimumDisplayTime - elapsed;
    if (remaining <= 0) {
      showTimeRef.current = null;
      setIsLoading(false);
    } else {
      stopTimerRef.current = setTimeout(() => {
        showTimeRef.current = null;
        stopTimerRef.current = null;
        setIsLoading(false);
      }, remaining);
    }
  }, [minimumDisplayTime]);

  const withLoading = useCallback(
    async <T>(promise: Promise<T>): Promise<T> => {
      startLoading();
      try {
        return await promise;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  const setProgress = useCallback((value: number) => {
    setProgressState(Math.min(100, Math.max(0, value)));
  }, []);

  return { isLoading, startLoading, stopLoading, withLoading, progress, setProgress };
}
