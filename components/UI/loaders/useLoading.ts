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
