'use client';
/**
 * FILE OBJECTIVE:
 * - Shows topics due for spaced revision (P3 logic applied to all tracked topics).
 * - Closes Gap #6: "No spaced-revision queue visible on the dashboard."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #6
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useReviewQueue, ReviewTopic } from '@/hooks/useReviewQueue';

function urgencyLabel(days: number): { label: string; colour: string } {
  if (days >= 14) return { label: 'Overdue', colour: 'text-red-600 bg-red-50 dark:bg-red-900/20' };
  if (days >= 7) return { label: 'Due soon', colour: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' };
  return { label: 'Review', colour: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' };
}

function TopicRow({ topic, onStart }: { topic: ReviewTopic; onStart: () => void }) {
  const { label, colour } = urgencyLabel(topic.daysSinceStudied);
  const masteryPct = Math.round(topic.mastery * 100);

  return (
    <button
      onClick={onStart}
      className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colour}`}>{label}</span>
          <span className="text-xs text-muted-foreground">{topic.daysSinceStudied}d ago</span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">{topic.topicName}</p>
        <p className="text-xs text-muted-foreground truncate">{topic.subject} · {topic.chapter}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-foreground">{masteryPct}%</p>
        <p className="text-xs text-muted-foreground">mastery</p>
      </div>
    </button>
  );
}

export function ReviewQueueCard() {
  const { topics, loading } = useReviewQueue();
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 py-3">
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-1/4" />
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (topics.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span>🔁</span> Review Queue
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {topics.length} due
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {topics.slice(0, 4).map((t) => (
          <TopicRow
            key={t.topicId}
            topic={t}
            onStart={() => router.push(`/session/${t.topicId}?reason=Time+for+revision`)}
          />
        ))}
      </div>

      {topics.length > 4 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          +{topics.length - 4} more topics to review
        </p>
      )}
    </div>
  );
}

export default ReviewQueueCard;
