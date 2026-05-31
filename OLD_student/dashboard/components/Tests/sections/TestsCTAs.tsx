'use client';
/**
 * FILE OBJECTIVE:
 * - Test call-to-action buttons with navigation handlers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/Tests/sections/TestsCTAs.spec.ts
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added onClick handlers for navigation
 */
import React, { useCallback } from 'react';
import { useTests } from '../context/TestsProvider';

export function TestsCTAs() {
  const { results } = useTests();
  
  const startNewTest = useCallback(() => {
    window.location.assign('/tests');
  }, []);
  
  const resumeLastTest = useCallback(() => {
    // Find most recent incomplete test result
    const lastResult = results[0];
    if (lastResult?.id) {
      window.location.assign(`/tests?resume=${encodeURIComponent(lastResult.id)}`);
    } else {
      window.location.assign('/tests');
    }
  }, [results]);
  
  const sharePracticeSet = useCallback(() => {
    // Copy share link to clipboard
    const shareUrl = `${window.location.origin}/tests`;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      alert('Practice set link copied!');
    }).catch(() => {
      window.location.assign('/tests');
    });
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <button 
        onClick={startNewTest}
        className="px-3 py-2 border rounded text-left hover:bg-muted/50 active:scale-[0.98] transition-transform flex items-center gap-2"
      >
        <span className="text-lg">🎯</span>
        <span>Start a New Test</span>
      </button>
      <button 
        onClick={resumeLastTest}
        className="px-3 py-2 border rounded text-left hover:bg-muted/50 active:scale-[0.98] transition-transform flex items-center gap-2"
      >
        <span className="text-lg">▶️</span>
        <span>Resume Last Test</span>
      </button>
      <button 
        onClick={sharePracticeSet}
        className="px-3 py-2 border rounded text-left hover:bg-muted/50 active:scale-[0.98] transition-transform flex items-center gap-2"
      >
        <span className="text-lg">📤</span>
        <span>Share Practice Set</span>
      </button>
    </div>
  );
}
