'use client';
/**
 * FILE OBJECTIVE:
 * - Display recommended tests with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Tests/sections/TestsRecommended.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for test navigation
 */
import React, { useCallback } from 'react';
import { useTests, TestItem } from '../context/TestsProvider';

export function TestsRecommended() {
  const { items, loading } = useTests();
  
  const startTest = useCallback((test: TestItem) => {
    // Navigate to tests page with test filter
    const params = new URLSearchParams();
    if (test.subject) params.set('subject', test.subject);
    if (test.id) params.set('testId', test.id);
    window.location.assign(`/tests?${params.toString()}`);
  }, []);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Recommended</h2>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No recommended tests yet</div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <button 
              key={t.id} 
              onClick={() => startTest(t)}
              className="w-full px-3 py-2 border rounded text-left hover:bg-muted/50 active:scale-[0.98] transition-transform flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <div>
                  <p className="font-medium text-sm">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.subject}</p>
                </div>
              </div>
              <span className="text-xs text-primary">Start →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
