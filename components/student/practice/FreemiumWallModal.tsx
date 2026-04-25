/**
 * FILE OBJECTIVE:
 * - S2.4 freemium wall modal with feature-specific copy and parent unlock request action.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/practice/FreemiumWallModal.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.4 freemium wall modal component
 */

'use client';

import React, { useMemo, useState } from 'react';

type FeatureType = 'practice' | 'ai_tutor' | 'chapter_quiz';

type FreemiumWallModalProps = {
  studentId: string;
  featureType?: FeatureType;
  onClose: () => void;
};

function contentByFeature(featureType: FeatureType): { title: string; body: string } {
  if (featureType === 'ai_tutor') {
    return {
      title: `You've used 3 AI Tutor questions today!`,
      body: 'Want to ask Teacher Vidya unlimited questions? Ask your parent to unlock Premium.',
    };
  }
  if (featureType === 'chapter_quiz') {
    return {
      title: 'Ready for the Chapter Quiz?',
      body: 'Chapter quizzes are a Premium feature. Unlock detailed score and weak-topic analysis.',
    };
  }
  return {
    title: `You've crushed all 5 free questions today!`,
    body: 'Want unlimited practice, AI tutoring, and chapter tests? Ask your parent to unlock Premium.',
  };
}

export default function FreemiumWallModal({
  studentId,
  featureType = 'practice',
  onClose,
}: FreemiumWallModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = useMemo(() => contentByFeature(featureType), [featureType]);

  async function sendRequest() {
    if (isSending || isSent) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/students/${encodeURIComponent(studentId)}/freemium/request-upgrade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureType }),
        }
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? 'Could not send request right now');
      }

      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request right now');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-4 pb-6 pt-10 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#534AB7]">Premium Unlock</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{content.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{content.body}</p>

        <button
          type="button"
          onClick={() => {
            void sendRequest();
          }}
          disabled={isSending || isSent}
          className="mt-5 min-h-[44px] w-full rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isSent ? 'Request Sent! ✓' : isSending ? 'Sending Request...' : 'Ask Parent to Unlock'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
        >
          Review Lesson Notes for Free
        </button>

        <p className="mt-2 text-center text-xs text-gray-500">
          Wait until tomorrow? Your 5 free questions reset at midnight.
        </p>

        {error && <p className="mt-3 text-xs text-[#E24B4A]">{error}</p>}
      </div>
    </div>
  );
}
