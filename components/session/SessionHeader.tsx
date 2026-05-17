'use client';
/**
 * FILE OBJECTIVE:
 * - Sticky session header: back button, topic title, breadcrumb, phase strip,
 *   and a thin linear progress bar showing overall phase completion.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | refactored -- progress bar extracted to SessionProgressBar
 * - 2026-04-22 | redesign | add back button, topic title, thin progress fill bar
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Star } from 'lucide-react';
import { SessionProgressBar } from './SessionProgressBar';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

interface SessionHeaderProps {
  session: SessionView;
  phase: PhaseContent;
  onStepClick?: (phase: string) => void;
  onAskVidya?: () => void;
  sessionId?: string;
}

export function SessionHeader({ session, phase: _phase, onStepClick, onAskVidya }: SessionHeaderProps) {
  const { topicName, subject, chapter: _chapter, phaseIndex, totalPhases, currentPhase } = session;
  const router = useRouter();

  const [_selectedStyle, _setSelectedStyle] = useState<string | null>(null);
  const [_updatingStyle, _setUpdatingStyle] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(
          `/api/tutor/session/style?sessionId=${encodeURIComponent(session.sessionId)}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (!mounted) return;
        _setSelectedStyle(data?.explainStyle ?? null);
      } catch {
        // best-effort: ignore failures
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session.sessionId]);

  // Completed phases as a percentage (0-100) for the thin progress fill.
  const progressPct = totalPhases > 0 ? Math.round((phaseIndex / totalPhases) * 100) : 0;

  async function handleStar(star: number) {
    setRating(star);
    setSubmitted(true);
    try {
      await fetch('/api/student/session/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, rating: star, phase: currentPhase }),
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
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50">
        {/* Top row: back button + topic name + subject chip + action cluster */}
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {topicName}
            </p>
            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
              {subject}
            </span>
          </div>
          {/* Right action cluster */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onAskVidya && (
              <button
                type="button"
                onClick={onAskVidya}
                aria-label="Ask Vidya"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={openFeedback}
              aria-label="Rate this lesson"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              <Star className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>
            {/* 28px progress ring */}
            <div className="relative w-7 h-7 flex-shrink-0">
              <svg className="w-full h-full" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border/30" />
                <circle
                  cx="14" cy="14" r="10" fill="none"
                  stroke="#534AB7" strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 10}`}
                  strokeDashoffset={`${2 * Math.PI * 10 * (1 - progressPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '14px 14px' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-medium text-foreground">
                {progressPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal phase strip */}
        <div className="px-4 pb-2 max-w-5xl mx-auto">
          <SessionProgressBar
            currentPhase={currentPhase as import('@/lib/session/phaseConfig').SessionPhaseClient}
            phaseIndex={phaseIndex}
            totalPhases={totalPhases}
            onStepClick={onStepClick}
          />
        </div>

        {/* Thin phase-progress fill bar */}
        <div
          className="h-0.5 bg-border/30"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Session progress"
        >
          <div
            className="h-full bg-[#534AB7] transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
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
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-transform active:scale-90 hover:scale-110"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${star <= rating ? 'text-[#BA7517] fill-[#BA7517]' : 'text-muted-foreground'}`}
                      strokeWidth={1.5}
                    />
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

export default SessionHeader;