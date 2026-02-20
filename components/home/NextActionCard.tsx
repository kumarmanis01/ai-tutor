"use client";

import React, { useState } from 'react';

export interface NextActionCardProps {
  subject?: string;
  chapter?: string;
  topic: string;
  stepIndex?: number;
  stepTotal?: number;
  estMinutes?: number;
  progressPct?: number; // 0-100
  masteryLevel?: string;
  reasonLabel?: string;
  ruleId?: string;
  lastSeenAt?: string | null;
  actionType?: 'lesson' | 'practice' | 'assignment' | string;
}

export default function NextActionCard(props: NextActionCardProps) {
  const [action, setAction] = useState<NextActionCardProps | null>(props);
  const [showWhy, setShowWhy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ctaText =
    action?.actionType === 'lesson'
      ? 'Continue Lesson'
      : action?.actionType === 'practice'
      ? 'Practice Topic'
      : action?.actionType === 'assignment'
      ? 'Open Assignment'
      : 'Start Lesson';

  const pct = Math.max(0, Math.min(100, Math.round(action?.progressPct || 0)));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dash = `${(pct / 100) * circumference} ${circumference}`;

  async function handleComplete() {
    if (!action || isSubmitting) return;
    const prev = action;

    // optimistic: remove current action from UI immediately
    setAction(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/home/complete-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prev),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();

      // If server returns a nextAction, render it; otherwise keep cleared state
      if (data && data.nextAction) {
        setAction(data.nextAction);
      } else {
        setAction(null);
      }
    } catch (e) {
      // revert optimistic change on error
      setAction(prev);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="max-w-4xl mx-auto bg-white rounded-lg border p-6 flex flex-col md:flex-row md:items-center gap-6 mb-8">
      {/* Primary CTA must be first focusable element in the DOM; visually placed last via order */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={isSubmitting || !action}
        className={`order-last md:order-none w-full md:w-44 text-white font-semibold py-4 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          action && !isSubmitting ? 'bg-indigo-700 hover:bg-indigo-800' : 'bg-gray-200 cursor-default text-gray-600'
        }`}
        aria-label={ctaText}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
              <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span>Updating…</span>
          </span>
        ) : (
          ctaText
        )}
      </button>

      <div className="flex-1">
        <div className="text-xs text-gray-500">Do this next</div>

        <div className="mt-3 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="text-sm text-gray-600 truncate">
              {action?.subject}
              {action?.subject && action?.chapter ? ' • ' : ''}
              {action?.chapter}
            </div>

            <h2 className="text-2xl md:text-3xl font-semibold leading-tight truncate mt-1">{action?.topic ?? '—'}</h2>

            <div className="mt-2 text-sm text-gray-500">
              {typeof action?.stepIndex === 'number' && typeof action?.stepTotal === 'number' ? (
                <span>
                  Step {action.stepIndex} of {action.stepTotal} •{' '}
                </span>
              ) : null}
              {typeof action?.estMinutes === 'number' ? <span>est {action.estMinutes} min</span> : <span>—</span>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
                <circle cx="24" cy="24" r="18" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r={radius}
                  stroke="#6366f1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={dash}
                  transform="rotate(-90 24 24)"
                />
                <text x="24" y="26" textAnchor="middle" fontSize="10" fill="#374151">
                  {pct}%
                </text>
              </svg>
            </div>

            <div className="flex flex-col items-start">
              {action?.masteryLevel ? <div className="text-sm font-medium">{action.masteryLevel}</div> : null}
              {action?.lastSeenAt ? <div className="text-xs text-gray-500">Seen {action.lastSeenAt}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={showWhy}
          onMouseEnter={() => setShowWhy(true)}
          onMouseLeave={() => setShowWhy(false)}
          onFocus={() => setShowWhy(true)}
          onBlur={() => setShowWhy(false)}
          className="p-1 rounded hover:bg-gray-100 focus:outline-none"
          aria-label={`Why this? rule ${action?.ruleId ?? 'unknown'}`}
        >
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="#9CA3AF" strokeWidth="1.5" />
            <path d="M11 10h2v6h-2v-6zM11 7h2v2h-2V7z" fill="#9CA3AF" />
          </svg>
        </button>

        {showWhy ? (
          <div
            role="tooltip"
            aria-label={`rule:${action?.ruleId ?? 'n/a'} reason:${action?.reasonLabel ?? 'n/a'}`}
            className="z-10 max-w-xs bg-white border rounded shadow p-2 text-xs text-gray-700"
          >
            <div className="font-medium text-sm">Why this?</div>
            <div className="mt-1">
              <div className="text-xs text-gray-600">Rule: {action?.ruleId ?? '—'}</div>
              <div className="text-xs text-gray-600">Reason: {action?.reasonLabel ?? '—'}</div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
