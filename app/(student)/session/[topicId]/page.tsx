/**
 * FILE OBJECTIVE:
 * - Route entry point for the Spinzy 6-phase learning session.
 * - Accepts topicId param and optional reasonLabel/estimatedTimeMin search params
 *   (passed by TodaysLearningCard from the recommendation engine).
 * - Renders SessionContainer which owns the full session lifecycle.
 *
 * URL shape:
 *   /session/[topicId]
 *   /session/[topicId]?reason=It+has+been+9+days&time=8
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { SessionContainer } from '@/components/Session/SessionContainer';

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const topicId = Array.isArray(params.topicId) ? params.topicId[0] : (params.topicId ?? '');
  const reasonLabel = searchParams.get('reason');
  const estimatedTimeMin = searchParams.get('time')
    ? Number(searchParams.get('time'))
    : undefined;

  if (!topicId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No topic specified.</p>
      </div>
    );
  }

  return (
    <SessionContainer
      topicId={topicId}
      reasonLabel={reasonLabel}
      estimatedTimeMin={estimatedTimeMin}
    />
  );
}
