'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type LoaderContextType = {
  startLoading: (label?: string) => void;
  stopLoading: () => void;
  resetLoading: () => void;
  loading: boolean;
  label?: string | null;
};

const GlobalLoaderContext = createContext<LoaderContextType | undefined>(undefined);

export function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState<string | undefined>(undefined);

  const startLoading = useCallback((lbl?: string) => {
    if (lbl) setLabel(lbl);
    setCount((c) => c + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setCount((c) => {
      const next = Math.max(0, c - 1);
      if (next === 0) setLabel(undefined);
      return next;
    });
  }, []);

  const resetLoading = useCallback(() => {
    setCount(0);
    setLabel(undefined);
  }, []);

  const value: LoaderContextType = {
    startLoading,
    stopLoading,
    resetLoading,
    loading: count > 0,
    label,
  };

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      {value.loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-4 border-[#534AB7] border-t-transparent animate-spin" />
          {value.label && (
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">{value.label}</p>
          )}
        </div>
      )}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const ctx = useContext(GlobalLoaderContext);
  
  // During SSG/SSR, context might be null - return safe defaults
  if (!ctx) {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        startLoading: () => {},
        stopLoading: () => {},
        resetLoading: () => {},
        loading: false,
        label: undefined,
      };
    }
    throw new Error('useGlobalLoader must be used within GlobalLoaderProvider');
  }
  
  return ctx;
}
