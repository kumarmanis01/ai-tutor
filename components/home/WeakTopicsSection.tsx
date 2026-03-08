/**
 * WeakTopicsSection
 *
 * Dashboard section showing up to 2 weak topics as cards.
 * Hidden when empty or when the student has fewer than 3 completed sessions
 * (avoid demoralising new students with "weak topic" labels before they've
 * even had a chance to learn anything).
 *
 * Design rules (UX architecture review):
 *   - Max 2 cards — showing 8 weak topics is demoralising
 *   - Uses qualitative masteryLabel, never raw percentages
 *   - Two-column card grid (not a list)
 *   - Each card links to starting a revision session on that topic
 *   - Completely hidden when empty or session count < 3
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created; replaces WeakTopicsCard
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
  /** Total sessions completed. Section hidden if < 3 (avoid early demoralisation). */
  sessionCount?: number;
}

export default function WeakTopicsSection({
  topics,
  sessionCount = 99,
}: WeakTopicsSectionProps) {
  // Hide before student has meaningful data
  if (sessionCount < 3) return null;
  // Hide when empty — no empty state displayed
  if (topics.length === 0) return null;

  const displayTopics = topics.slice(0, 2);

  return (
    <section aria-labelledby="weak-topics-heading">
      <h3 id="weak-topics-heading" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        These need more practice
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {displayTopics.map((topic) => (
          <article
            key={topic.topicId}
            className="rounded-xl border border-red-100 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {topic.topicName}
            </p>
            <p className="mt-1 text-xs text-red-500 font-medium">{topic.masteryLabel}</p>
            <Link
              href={`/session/${topic.topicId}`}
              className="mt-3 inline-block w-full text-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Revise
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
