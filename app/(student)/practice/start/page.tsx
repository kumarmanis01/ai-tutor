'use client';
/**
 * FILE OBJECTIVE:
 * - Entry point for starting a practice session with a specific topic.
 * - Enforces state machine: practice cannot start without a valid topicId.
 * - Guards against standalone practice entry with no topic context.
 *
 * Flow: LEARN_TOPIC → COMPLETE_NOTES → PRACTICE_TOPIC → UPDATE_MASTERY
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per route-alignment + state machine spec
 */
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PracticeStartContent() {
  const router = useRouter();
  const params = useSearchParams();
  const topicId = params.get('topicId');
  const difficulty = params.get('difficulty') ?? 'medium';

  useEffect(() => {
    if (!topicId) {
      // Guard: no topicId → redirect to dashboard to begin the learn flow
      router.replace('/dashboard');
      return;
    }
    // Forward to the existing tests page with topicId context pre-set
    router.replace(
      `/tests?topicId=${encodeURIComponent(topicId)}&difficulty=${encodeURIComponent(difficulty)}`
    );
  }, [topicId, difficulty, router]);

  return (
    <div className="flex items-center justify-center min-h-40">
      <p className="text-sm text-muted-foreground">Loading practice session...</p>
    </div>
  );
}

export default function PracticeStartPage() {
  return (
    <Suspense>
      <PracticeStartContent />
    </Suspense>
  );
}
