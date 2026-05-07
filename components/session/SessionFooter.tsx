'use client';
/**
 * FILE OBJECTIVE:
 * - Session footer with Previous / Next Step navigation.
 * - Sits sticky above the fixed SessionBottomBar (bottom-16 = 64px from base).
 * - Shown in phases where navigation makes sense.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 * - 2026-04-22 | redesign | full-width buttons; sticky bottom-16 to clear SessionBottomBar
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
    <div
      className="sticky z-30 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-2">
        {/* Primary CTA -- always full width */}
        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled || loading}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 bg-[#534AB7] hover:bg-[#3C3489] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm shadow-md shadow-[#534AB7]/20"
          >
            {loading ? (
              <span className="animate-spin text-base" aria-label="Loading">
                ⏳
              </span>
            ) : (
              <>
                <span>{nextLabel}</span>
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        )}

        {/* Previous -- outline, full width */}
        {showPrevious && onPrevious && (
          <button
            onClick={onPrevious}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-xl transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default SessionFooter;