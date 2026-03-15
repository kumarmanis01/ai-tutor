/**
 * WeakTopicsSection — v2
 *
 * Hidden until student has ≥ 3 completed sessions (avoids demoralising newcomers).
 * Shows max 2 topics as cards. Uses qualitative label, never raw percentages.
 * Links directly to revision session on that topic.
 */

import React from 'react';
import Link from 'next/link';

export interface WeakTopicItem {
  topicId: string;
  topicName: string;
  masteryLabel: string;
}

export interface WeakTopicsSectionProps {
  topics: WeakTopicItem[];
  sessionCount?: number;
}

export default function WeakTopicsSection({
  topics,
  sessionCount = 99,
}: WeakTopicsSectionProps) {
  if (sessionCount < 3) return null;
  if (topics.length === 0) return null;

  const display = topics.slice(0, 2);

  return (
    <section aria-labelledby="weak-topics-heading">
      <h3
        id="weak-topics-heading"
        className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
      >
        Needs more practice
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {display.map((topic) => (
          <article
            key={topic.topicId}
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 mb-1">
              {topic.topicName}
            </p>
            <p className="text-xs font-medium text-[#E24B4A] dark:text-red-400 mb-3">
              {topic.masteryLabel}
            </p>
            <Link
              href={`/session/${topic.topicId}`}
              className="flex w-full min-h-[44px] items-center justify-center rounded-lg border border-[#534AB7]/30 bg-[#534AB7]/5 dark:bg-[#534AB7]/10 text-xs font-semibold text-[#534AB7] dark:text-indigo-300 hover:bg-[#534AB7]/10 dark:hover:bg-[#534AB7]/20 transition-colors"
            >
              Revise
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
