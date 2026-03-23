'use client';

/**
 * AiNarrativeWidget -- "Vidya's insight" section on the progress report page.
 *
 * Fetches /api/student/progress/narrative on mount and renders a 2-3 sentence
 * AI-generated summary of the student's last 30 days. Independent loading and
 * error states ensure one failing widget never blanks the whole page.
 *
 * PDF download is a placeholder -- shows "coming soon" toast (deferred feature).
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/lib/toast';

type State = 'loading' | 'error' | 'populated';

export default function AiNarrativeWidget() {
  const [state, setState] = useState<State>('loading');
  const [narrative, setNarrative] = useState('');

  const fetchNarrative = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/student/progress/narrative');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { narrative?: string };
      if (!data.narrative) throw new Error('empty narrative');
      setNarrative(data.narrative);
      setState('populated');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void fetchNarrative();
  }, [fetchNarrative]);

  if (state === 'loading') {
    return (
      <article
        className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
        aria-busy="true"
        aria-label="Loading Teacher Vidya's insight"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-24 bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 dark:bg-slate-600 rounded animate-pulse" />
        </div>
      </article>
    );
  }

  if (state === 'error') {
    return (
      <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {"Teacher Vidya will be right back. "}
          <button
            onClick={fetchNarrative}
            className="underline text-[#534AB7] dark:text-[#9B96E0] min-h-[44px] inline-flex items-center"
          >
            Please try again in a moment.
          </button>
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[#534AB7]/20 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#534AB7] dark:text-[#9B96E0]">
          {"Teacher Vidya's insight"}
        </span>
        <button
          onClick={() => toast('PDF download coming soon!')}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-h-[44px] px-3 flex items-center rounded-lg transition-colors"
          aria-label="Download progress report as PDF"
        >
          Download PDF
        </button>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{narrative}</p>
    </article>
  );
}
