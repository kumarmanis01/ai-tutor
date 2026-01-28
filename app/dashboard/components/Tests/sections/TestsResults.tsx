'use client';
/**
 * FILE OBJECTIVE:
 * - Display recent test results with navigation to review.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Tests/sections/TestsResults.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for result review
 */
import React, { useCallback } from 'react';
import { useTests, TestResult } from '../context/TestsProvider';

export function TestsResults() {
  const { results, loading } = useTests();
  
  const viewResult = useCallback((result: TestResult) => {
    window.location.assign(`/tests?review=${encodeURIComponent(result.id)}`);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Recent Results</h2>
      {loading && results.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : results.length === 0 ? (
        <div className="text-sm text-muted-foreground">No results yet. Take a test to see your scores!</div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <button 
              key={r.id} 
              onClick={() => viewResult(r)}
              className="w-full px-3 py-2 border rounded text-left flex items-center justify-between hover:bg-muted/50 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.score >= 80 ? '🏆' : r.score >= 60 ? '📊' : '📈'}</span>
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${getScoreColor(r.score)}`}>{r.score}%</span>
                <p className="text-xs text-primary">Review →</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
