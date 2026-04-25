/**
 * FILE OBJECTIVE:
 * - Global loading context and provider that lets any component trigger the
 *   full-screen loader from anywhere in the tree without prop drilling.
 * - Exposes showLoader / hideLoader / updateProgress via useGlobalLoader hook.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/loaders/FullScreenLoader.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | claude | created for global loader system
 */

'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { FullScreenLoader } from './FullScreenLoader';
import type { GlobalLoaderContextValue, GlobalLoaderState, LoaderVariant } from './types';

const DEFAULT_STATE: GlobalLoaderState = {
  visible: false,
  variant: 'dots',
  progress: 0,
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const [loaderState, setLoaderState] = useState<GlobalLoaderState>(DEFAULT_STATE);

  const showLoader = useCallback((message?: string, variant: LoaderVariant = 'dots') => {
    setLoaderState({ visible: true, message, variant, progress: 0 });
  }, []);

  const hideLoader = useCallback(() => {
    setLoaderState((prev) => ({ ...prev, visible: false }));
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setLoaderState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  return (
    <GlobalLoaderContext.Provider value={{ showLoader, hideLoader, updateProgress, loaderState }}>
      {children}
      <FullScreenLoader
        visible={loaderState.visible}
        variant={loaderState.variant}
        message={loaderState.message}
        progress={loaderState.progress}
      />
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader(): GlobalLoaderContextValue {
  const ctx = useContext(GlobalLoaderContext);
  if (!ctx) throw new Error('useGlobalLoader must be used inside GlobalLoaderProvider');
  return ctx;
}
