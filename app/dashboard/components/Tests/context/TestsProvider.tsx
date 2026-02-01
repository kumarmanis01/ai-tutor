"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';

export type TestItem = { id: string; title: string; subject: string };
export type TestResult = { id: string; title: string; score: number; date: string };

export interface TestsService {
  fetchRecommended(subject: string, grade?: string, board?: string): Promise<TestItem[]>;
  fetchUpcoming(subject: string, grade?: string, board?: string): Promise<TestItem[]>;
  fetchRecentResults(): Promise<TestResult[]>;
}

export class HttpTestsService implements TestsService {
  async fetchRecommended(subject: string, grade?: string, board?: string) {
    const qs = new URLSearchParams({ subject, ...(grade ? { grade } : {}), ...(board ? { board } : {}) });
    const res = await fetch(`/api/tests/recommended?${qs}`);
    if (!res.ok) return [];
    return (await res.json()).items ?? [];
  }
  async fetchUpcoming(subject: string, grade?: string, board?: string) {
    const qs = new URLSearchParams({ subject, ...(grade ? { grade } : {}), ...(board ? { board } : {}) });
    const res = await fetch(`/api/tests/upcoming?${qs}`);
    if (!res.ok) return [];
    return (await res.json()).items ?? [];
  }
  async fetchRecentResults() {
    const res = await fetch('/api/tests/results/recent');
    if (!res.ok) return [];
    return (await res.json()).results ?? [];
  }
}

export type TestsState = {
  items: TestItem[];
  upcoming: TestItem[];
  results: TestResult[];
  loading: boolean;
};

export type TestsAPI = TestsState & {
  refresh: (subject: string, grade?: string, board?: string) => Promise<void>;
};

const Ctx = createContext<TestsAPI | null>(null);

export function TestsProvider({ children, service }: { children: React.ReactNode; service?: TestsService }) {
  const svc = useMemo(() => service ?? new HttpTestsService(), [service]);
  const [state, setState] = useState<TestsState>({ items: [], upcoming: [], results: [], loading: false });

  const refresh = useCallback(async (subject: string, grade?: string, board?: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [items, upcoming, results] = await Promise.all([
        svc.fetchRecommended(subject, grade, board),
        svc.fetchUpcoming(subject, grade, board),
        svc.fetchRecentResults(),
      ]);
      setState((s) => ({ ...s, items, upcoming, results }));
      logger.info('tests.refresh', { subject, grade, board });
    } catch (e) {
      logger.warn('tests.refresh.error', { message: String(e) });
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [svc]);

  const api: TestsAPI = {
    ...state,
    refresh,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTests() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTests must be used within TestsProvider');
  return ctx;
}
