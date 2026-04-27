/**
 * FILE OBJECTIVE:
 * - S3.2: Student generation page -- connects to the SSE stream for a jobId,
 *   shows ContentGenerationLoading while waiting, transitions to StreamingContent
 *   as blocks arrive, and falls back to a push notification message after 60s.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(student)/student/learning-map/generate/[jobId]/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.2 generation loading page
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ContentGenerationLoading } from '@/components/student/content-generation/ContentGenerationLoading';
import { StreamingContent } from '@/components/student/content-generation/StreamingContent';
import { logger } from '@/lib/logger';

type ContentBlock = {
  type: 'intro' | 'section' | 'bullets' | 'example' | 'summary';
  title?: string;
  body?: string;
  items?: string[];
};

type StreamState = 'loading' | 'streaming' | 'done' | 'fallback' | 'error';

const FALLBACK_TIMEOUT_MS = 60_000; // 60s before showing fallback notification

/**
 * S3.2 -- Generation experience page.
 * Route: /student/learning-map/generate/[jobId]
 */
export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  const [topic, setTopic] = useState('your topic');
  const [streamState, setStreamState] = useState<StreamState>('loading');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evtSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Set fallback timer -- if no content arrives within 60s, show push notification message
    fallbackTimerRef.current = setTimeout(() => {
      if (streamState === 'loading') {
        setStreamState('fallback');
        evtSourceRef.current?.close();
      }
    }, FALLBACK_TIMEOUT_MS);

    // Connect to SSE stream
    const source = new EventSource(`/api/v1/content/generation/${encodeURIComponent(jobId)}/stream`);
    evtSourceRef.current = source;

    source.onopen = () => {
      // Stream connected -- keep loading state until first block
    };

    source.addEventListener('start', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as { topic?: string };
        if (data.topic) setTopic(data.topic);
      } catch {
        // Non-critical -- topic already defaulted
      }
      setStreamState('streaming');
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    });

    source.addEventListener('block', (ev: MessageEvent) => {
      try {
        const block = JSON.parse(ev.data as string) as ContentBlock;
        setBlocks((prev) => [...prev, block]);
        if (streamState === 'loading') setStreamState('streaming');
      } catch (parseErr) {
        logger.error('GeneratePage: failed to parse SSE block', { jobId, error: parseErr });
      }
    });

    source.addEventListener('done', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as { topic?: string; contentId?: string };
        if (data.topic) setTopic(data.topic);
      } catch {
        // Non-critical
      }
      setStreamState('done');
      source.close();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    });

    source.addEventListener('error_event', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as { message?: string };
        setErrorMsg(data.message ?? 'Generation failed');
      } catch {
        setErrorMsg('Generation failed');
      }
      setStreamState('error');
      source.close();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    });

    source.onerror = () => {
      // SSE disconnected -- check if we already have content
      setStreamState((prev) => {
        if (prev === 'streaming') return 'done';
        if (prev === 'loading') return 'fallback';
        return prev;
      });
      source.close();
    };

    return () => {
      source.close();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
    // jobId is the only stable dep; router not reactive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (streamState === 'error') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div className="mb-4 text-5xl">😕</div>
        <h2 className="text-lg font-bold text-gray-900">Content generation failed</h2>
        <p className="mt-2 text-sm text-gray-500">
          {errorMsg || 'Something went wrong. Please try again.'}
        </p>
        <Link
          href="/student/learning-map"
          className="mt-6 inline-block min-h-[44px] rounded-xl bg-[#534AB7] px-6 py-2 text-sm font-semibold text-white hover:bg-[#4239a0]"
        >
          Back to Learning Map
        </Link>
      </div>
    );
  }

  if (streamState === 'fallback') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div className="mb-4 text-5xl">🔔</div>
        <h2 className="text-lg font-bold text-gray-900">Notes are being prepared!</h2>
        <p className="mt-2 text-sm text-gray-500">
          This is taking a bit longer than usual. We&apos;ll notify you when your notes
          on <strong>{topic}</strong> are ready.
        </p>
        <Link
          href="/student/learning-map"
          className="mt-6 inline-block min-h-[44px] rounded-xl bg-[#534AB7] px-6 py-2 text-sm font-semibold text-white hover:bg-[#4239a0]"
        >
          Back to Learning Map
        </Link>
      </div>
    );
  }

  if (streamState === 'loading') {
    return <ContentGenerationLoading topic={topic} />;
  }

  return (
    <div>
      <StreamingContent topic={topic} blocks={blocks} isStreaming={streamState === 'streaming'} />
      {streamState === 'done' && (
        <div className="mx-auto max-w-2xl px-4 pb-8">
          <button
            type="button"
            onClick={() => router.push('/student/learning-map')}
            className="min-h-[44px] w-full rounded-xl border border-[#534AB7] px-4 text-sm font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
          >
            Back to Learning Map
          </button>
        </div>
      )}
    </div>
  );
}
