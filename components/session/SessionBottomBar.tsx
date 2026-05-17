'use client';
/**
 * FILE OBJECTIVE:
 * - Fixed bottom strip always visible during active session phases.
 * - Left: "Ask Vidya" -- triggers the DoubtPanel slide-up.
 * - Right: "Feedback" -- opens a 5-star rating bottom sheet; submits to API.
 *
 * EDIT LOG:
 * - 2026-04-22 | redesign | created; replaces DoubtPanel floating FAB
 */

import React, { useState } from 'react';
import Image from 'next/image';

interface SessionBottomBarProps {
  onAskVidya: () => void;
  sessionId: string;
  currentPhase: string;
}

export function SessionBottomBar({ onAskVidya, sessionId, currentPhase }: SessionBottomBarProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  async function handleStar(star: number) {
    setRating(star);
    setSubmitted(true);
    try {
      await fetch('/api/student/session/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating: star, phase: currentPhase }),
      });
    } catch {
      // fire-and-forget -- never block the student on this
    }
    setTimeout(() => setFeedbackOpen(false), 900);
  }

  function openFeedback() {
    setRating(0);
    setSubmitted(false);
    setFeedbackOpen(true);
  }

  return (
    <>
      {/* Fixed bottom strip */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch h-16 max-w-2xl mx-auto divide-x divide-border/30">
          {/* Ask Vidya */}
          <button
            type="button"
            onClick={onAskVidya}
            className="flex-1 flex items-center gap-2.5 px-4 min-h-[44px] hover:bg-muted/50 transition-colors text-left"
          >
            <Image
              src="/logos/vidya/vidya-avatar-64.png"
              alt=""
              width={28}
              height={28}
              className="rounded-full flex-shrink-0 object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">Ask Vidya</p>
              <p className="text-xs text-muted-foreground leading-tight truncate">
                Get help with this topic
              </p>
            </div>
          </button>

          {/* Feedback */}
          <button
            type="button"
            onClick={openFeedback}
            className="flex-1 flex items-center gap-2.5 px-4 min-h-[44px] hover:bg-muted/50 transition-colors text-left"
          >
            <span className="text-2xl flex-shrink-0" aria-hidden>
              {rating > 0 ? '*' : '*'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">Feedback</p>
              <p className="text-xs text-muted-foreground leading-tight truncate">
                Rate this lesson
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Feedback bottom sheet */}
      {feedbackOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setFeedbackOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl px-6 pt-6 shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            role="dialog"
            aria-label="Rate this lesson"
            aria-modal="true"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" aria-hidden />
            <p className="text-base font-semibold text-center mb-1">How was this lesson?</p>
            <p className="text-xs text-muted-foreground text-center mb-6">
              Your feedback helps Vidya improve
            </p>

            {!submitted ? (
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStar(star)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-3xl transition-transform active:scale-90 hover:scale-110"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <span aria-hidden>{star <= rating ? '*' : '*'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-[#1D9E75] font-semibold text-base mb-6">
                Thank you! Your feedback helps us improve.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default SessionBottomBar;