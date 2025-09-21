// hooks/useLocalStorage.ts
'use client';

import { useEffect, useState } from "react";

/**
 * useLocalStorage — small typed hook to keep data in localStorage.
 * - Key is prefixed for the app
 * - Values are JSON serialized
 * - Keeps a clean separation of storage strategy
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const fullKey = `ai-tutor:${key}`;
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window === "undefined") return initial;
      const raw = localStorage.getItem(fullKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(state));
    } catch {
      // ignore storage errors (quota)
    }
  }, [fullKey, state]);

  return [state, setState] as const;
}
