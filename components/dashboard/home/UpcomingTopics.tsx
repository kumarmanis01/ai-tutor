'use client';
/**
 * FILE OBJECTIVE:
 * - Shows next 4 unstarted curriculum topics in learning order.
 * - Closes Gap #9: "No curriculum roadmap preview."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Gap #9
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUpcomingTopics, UpcomingTopic } from '@/hooks/useUpcomingTopics';

const SUBJECT_ICONS: Record<string, string> = {
  Mathematics: '📐',
  Science: '🔬',
  Physics: '⚡',
  Chemistry: '🧪',
  Biology: '🌿',
  English: '📝',
  History: '🏛',
  Geography: '🌍',
};

function subjectIcon(name: string): string {
  return SUBJECT_ICONS[name] ?? '📚';
}

export function UpcomingTopics() {
  const { topics, loading } = useUpcomingTopics();
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (topics.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-4 border">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>🗺</span> What&apos;s Next
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {topics.slice(0, 4).map((t: UpcomingTopic, i) => (
          <button
            key={t.topicId}
            onClick={() => router.push(`/session/${t.topicId}`)}
            className="text-left p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors border border-transparent hover:border-border"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{subjectIcon(t.subject)}</span>
              {i === 0 && (
                <span className="text-xs text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                  Up next
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
              {t.topicName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.chapter}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default UpcomingTopics;
