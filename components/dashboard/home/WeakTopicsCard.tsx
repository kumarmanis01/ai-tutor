'use client';
/**
 * FILE OBJECTIVE:
 * - Lists topics where mastery < 45% and student has practised ≥2 times.
 * - Closes Gap #7: "No weak-topic nudge on dashboard."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #7
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useWeakTopics, WeakTopic } from '@/hooks/useWeakTopics';

function TopicRow({ topic, onFix }: { topic: WeakTopic; onFix: () => void }) {
  const masteryPct = Math.round(topic.mastery * 100);

  return (
    <button
      onClick={onFix}
      className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-lg">
        ⚠️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{topic.topicName}</p>
        <p className="text-xs text-muted-foreground truncate">{topic.subject} · {topic.chapter}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-red-500">{masteryPct}%</p>
        <p className="text-xs text-muted-foreground">{topic.accuracyPercent}% acc</p>
      </div>
    </button>
  );
}

export function WeakTopicsCard() {
  const { topics, loading } = useWeakTopics();
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 py-3 items-center">
            <div className="w-10 h-10 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
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
    <div className="bg-card rounded-xl p-4 border border-red-200 dark:border-red-800/40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span>🎯</span> Strengthen These
        </h3>
        <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
          {topics.length} weak
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Practice these topics again to build confidence.
      </p>

      <div className="divide-y divide-border/50">
        {topics.slice(0, 3).map((t) => (
          <TopicRow
            key={t.topicId}
            topic={t}
            onFix={() => router.push(`/session/${t.topicId}?reason=Let%27s+strengthen+this+topic`)}
          />
        ))}
      </div>
    </div>
  );
}

export default WeakTopicsCard;
