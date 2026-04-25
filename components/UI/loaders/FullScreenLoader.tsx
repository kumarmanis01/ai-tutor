'use client';

import { useState, useEffect, useRef } from 'react';
import type { FullScreenLoaderProps } from './types';
import {
  DotPulseLoader,
  SpinnerLoader,
  BookLoader,
  ProgressLoader,
  MascotLoader,
} from './LoaderVariants';

export function FullScreenLoader({
  visible,
  variant = 'dots',
  message,
  progress = 0,
  showProgress = false,
  minimumDisplayTime = 300,
}: FullScreenLoaderProps) {
  const [rendered, setRendered] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const showTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (visible) {
      clearTimer();
      setAnimatingOut(false);
      setRendered(true);
      showTimeRef.current = Date.now();
    } else if (rendered) {
      const elapsed =
        showTimeRef.current !== null ? Date.now() - showTimeRef.current : minimumDisplayTime;
      const remaining = Math.max(0, minimumDisplayTime - elapsed);
      timerRef.current = setTimeout(() => {
        setAnimatingOut(true);
        // Remove from DOM after fade-out animation completes
        timerRef.current = setTimeout(() => {
          setRendered(false);
          setAnimatingOut(false);
          showTimeRef.current = null;
        }, 260);
      }, remaining);
    }

    return clearTimer;
  }, [visible, rendered, minimumDisplayTime]);

  if (!rendered) return null;

  const loaderContent = (() => {
    switch (variant) {
      case 'spinner':
        return <SpinnerLoader size="large" />;
      case 'book':
        return <BookLoader />;
      case 'progress':
        return <ProgressLoader progress={progress} showProgress={showProgress} className="w-64" />;
      case 'mascot':
        return <MascotLoader />;
      default:
        return <DotPulseLoader size="large" />;
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={message ?? 'Loading, please wait'}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm ${
        animatingOut ? 'loader-animate-out' : 'loader-animate-in'
      }`}
    >
      {loaderContent}
      {message && (
        <p className="mt-5 text-sm font-medium text-gray-700 dark:text-gray-300 text-center max-w-xs px-4">
          {message}
        </p>
      )}
    </div>
  );
}
