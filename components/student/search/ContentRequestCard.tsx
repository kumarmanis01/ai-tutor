/**
 * FILE OBJECTIVE:
 * - S3.1: ContentRequestCard -- shows "We don't have notes on X yet" card
 *   with a "Generate Notes for Me" button when search returns 0 results.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/search/ContentRequestCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.1 ContentRequestCard component
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

type ContentRequestCardProps = {
  query: string;
  grade: number;
  board: string;
  subject?: string;
};

type GenerationState = 'idle' | 'checking' | 'pending' | 'requesting' | 'done' | 'error';

/**
 * S3.1 -- Shown when content search returns 0 results.
 * Offers "Generate Notes for Me" which enqueues a GenerationJob (S3.2).
 */
export function ContentRequestCard({ query, grade, board, subject }: ContentRequestCardProps) {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleGenerate() {
    setState('requesting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/content/generation/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: query,
          subject: subject ?? 'General',
          grade,
          board,
          language: 'en',
        }),
      });
      const data = (await res.json()) as { jobId?: string; code?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? 'Request failed');
      }
      if (data.jobId) {
        setState('done');
        // Navigate to the generation loading page (S3.2)
        router.push(`/student/learning-map/generate/${data.jobId}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      logger.error('ContentRequestCard: generation request failed', { query, error: err });
      setErrorMsg(msg);
      setState('error');
    }
  }

  const isPending = state === 'pending';
  const isRequesting = state === 'requesting';
  const isDisabled = isPending || isRequesting || state === 'done';

  return (
    <div className="mt-6 rounded-2xl border border-[#534AB7]/20 bg-[#EEEDFE] p-5">
      {/* Illustration placeholder */}
      <div className="mb-3 text-3xl" aria-hidden="true">
        🧑‍🏫
      </div>

      <h3 className="text-base font-bold text-[#3C3489]">
        We don&apos;t have notes on &ldquo;{query}&rdquo; yet!
      </h3>
      <p className="mt-1 text-sm text-[#534AB7]">
        Our AI Teacher can create them for you in about 30 seconds.
      </p>

      {isPending ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#534AB7]/10 px-4 py-3">
          <span className="animate-spin text-lg">⏳</span>
          <span className="text-sm font-medium text-[#534AB7]">Content is being prepared...</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => void handleGenerate()}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4239a0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRequesting ? 'Sending request...' : 'Generate Notes for Me'}
        </button>
      )}

      {state === 'error' && (
        <p className="mt-2 text-xs text-[#E24B4A]">{errorMsg}. Please try again.</p>
      )}

      <p className="mt-3 text-xs text-[#534AB7]/70">
        Generated content is AI-drafted and reviewed by teachers.
      </p>
    </div>
  );
}

export default ContentRequestCard;
