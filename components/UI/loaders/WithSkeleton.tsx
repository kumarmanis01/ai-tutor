'use client';

import { useState, useEffect, useRef } from 'react';
import type { WithSkeletonProps } from './types';

export function WithSkeleton({ isLoading, skeleton, children, delay = 200 }: WithSkeletonProps) {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const mountTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isLoading) {
      mountTimeRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      const elapsed = Date.now() - mountTimeRef.current;
      const remaining = delay - elapsed;
      if (remaining <= 0) {
        setShowSkeleton(false);
      } else {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setShowSkeleton(false);
        }, remaining);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading, delay]);

  return <>{showSkeleton ? skeleton : children}</>;
}
