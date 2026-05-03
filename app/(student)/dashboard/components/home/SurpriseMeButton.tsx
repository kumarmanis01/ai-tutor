'use client';
/**
 * FILE OBJECTIVE:
 * - "Surprise Me" CTA button that picks the student's most urgent weak topic.
 * - Calls GET /api/student/surprise-me, navigates to the session on success.
 * - Full error handling: 401, 204, network failures all surface a friendly message.
 * - Loading state shows inline spinner without layout shift.
 *
 * EDIT LOG:
 * - 2026-05-03 | claude | restored + hardened from commented-out SecondaryStartOptions
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SurpriseMeButtonProps {
  className?: string;
}

export function SurpriseMeButton({ className = '' }: SurpriseMeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSurprise = async () => {
    if (loading) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/student/surprise-me');

      if (res.status === 401) {
        setFeedback('Please sign in to use Surprise Me.');
        return;
      }

      if (res.status === 204) {
        setFeedback("No suggestions right now. Try browsing topics!");
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        setFeedback("Couldn't pick a topic -- tap to retry.");
        return;
      }

      const action = json?.action;
      if (!action?.topicId) {
        setFeedback("Nothing to surprise you with right now!");
        return;
      }

      router.push(`/session/${encodeURIComponent(action.topicId)}`);
    } catch {
      setFeedback("Couldn't connect -- tap to retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleSurprise}
        disabled={loading}
        className={`flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-xl
                    bg-gradient-to-r from-[#534AB7] to-[#7C3AED] hover:from-[#4840a3] hover:to-[#6d28d9]
                    text-white text-sm font-semibold shadow-md shadow-[#534AB7]/25
                    disabled:opacity-60 transition-all active:scale-95 ${className}`}
        aria-label="Surprise Me - pick a topic for me"
      >
        {loading ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>Finding your topic...</span>
          </>
        ) : (
          <>
            <span className="text-base">🎲</span>
            <span>Surprise Me!</span>
          </>
        )}
      </button>

      {feedback && (
        <p className="text-xs text-center text-muted-foreground px-2 py-1">{feedback}</p>
      )}
    </div>
  );
}

export default SurpriseMeButton;
