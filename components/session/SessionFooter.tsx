'use client';
/**
 * FILE OBJECTIVE:
 * - Session footer with Previous / Next Step navigation.
 * - Shown in phases where back-navigation makes sense (Explanation, Practice).
 * - Hidden in phases that must complete before advancing (Practice, Test).
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import React from 'react';

interface SessionFooterProps {
  onPrevious?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showPrevious?: boolean;
}

export function SessionFooter({
  onPrevious,
  onNext,
  nextLabel = 'Next Step',
  nextDisabled = false,
  loading = false,
  showPrevious = false,
}: SessionFooterProps) {
  if (!onPrevious && !onNext) return null;

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {showPrevious && onPrevious ? (
          <button
            onClick={onPrevious}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
        ) : (
          <div />
        )}

        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-colors text-sm shadow-md shadow-primary/20"
          >
            {loading ? (
              <span className="animate-spin text-base">⏳</span>
            ) : (
              <>
                <span>{nextLabel}</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default SessionFooter;
