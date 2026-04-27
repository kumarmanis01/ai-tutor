'use client';
/**
 * FILE OBJECTIVE:
 * - Display tests grouped by subject with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Tests/sections/TestsBySubject.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for subject navigation
 */
import React, { useCallback } from 'react';
import { useTests } from '../context/TestsProvider';

export function TestsBySubject() {
  const { items } = useTests();
  const groups = items.reduce<Record<string, { id: string; title: string }[]>>((acc, it) => {
    acc[it.subject] = acc[it.subject] || [];
    acc[it.subject].push({ id: it.id, title: it.title });
    return acc;
  }, {});

  const navigateToTest = useCallback((testId: string, subject: string) => {
    const params = new URLSearchParams({ subject, testId });
    window.location.assign(`/tests?${params.toString()}`);
  }, []);

  const navigateToSubject = useCallback((subject: string) => {
    // eslint-disable-next-line ai-guards/no-string-filters -- Legacy code, refactor to use subjectId later
    window.location.assign(`/tests?subject=${encodeURIComponent(subject)}`);
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">By Subject</h2>
      {Object.keys(groups).length === 0 ? (
        <div className="text-sm text-muted-foreground">No items</div>
      ) : (
        Object.entries(groups).map(([subject, tests]) => (
          <div key={subject} className="space-y-2">
            <button 
              onClick={() => navigateToSubject(subject)}
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              📚 {subject}
              <span className="text-xs text-muted-foreground">({tests.length})</span>
            </button>
            <div className="space-y-1 pl-4">
              {tests.slice(0, 3).map((t) => (
                <button 
                  key={t.id} 
                  onClick={() => navigateToTest(t.id, subject)}
                  className="w-full px-3 py-2 border rounded text-left hover:bg-muted/50 active:scale-[0.98] transition-transform text-sm"
                >
                  {t.title}
                </button>
              ))}
              {tests.length > 3 && (
                <button 
                  onClick={() => navigateToSubject(subject)}
                  className="text-xs text-primary hover:underline"
                >
                  +{tests.length - 3} more →
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
