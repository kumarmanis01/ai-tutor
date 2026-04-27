'use client';
/**
 * FILE OBJECTIVE:
 * - Resume an in-progress practice session by sessionId.
 * - Connects to existing /tests resume flow.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per route-alignment spec
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PracticeSessionPage({ params }: { params: { sessionId: string } }) {
  const router    = useRouter();
  const sessionId = params.sessionId;

  useEffect(() => {
    if (!sessionId) {
      router.replace('/dashboard/tests');
      return;
    }
    // Forward to existing tests page with resume context
    router.replace(`/tests?practice=${encodeURIComponent(sessionId)}`);
  }, [sessionId, router]);

  return (
    <div className="flex items-center justify-center min-h-40">
      <p className="text-sm text-muted-foreground">Resuming session...</p>
    </div>
  );
}
