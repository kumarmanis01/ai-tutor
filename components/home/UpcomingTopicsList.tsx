/**
 * UpcomingTopicsList — v2
 *
 * Simple list rows for the next 3 topics from the LearningPlan.
 * Low visual weight — plain rows, not cards.
 * Includes "View full learning path" link.
 */

import React from 'react';
import Link from 'next/link';

export interface UpcomingTopic {
  topicId: string;
  topicTitle: string;
  subject: string;
}

export interface UpcomingTopicsListProps {
  topics: UpcomingTopic[];
}

export default function UpcomingTopicsList({ topics }: UpcomingTopicsListProps) {
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-heading">
      <h3
        id="upcoming-heading"
        className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
      >
        Up next
      </h3>

      <ul className="space-y-1" role="list">
        {topics.slice(0, 3).map((topic, i) => (
          <li
            key={topic.topicId}
            className="flex items-center gap-3 rounded-xl px-3 py-3 min-h-[44px] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {topic.topicTitle}
              </p>
              {topic.subject && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{topic.subject}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/learn/learning-path"
        className="mt-3 inline-flex min-h-[44px] items-center text-xs font-medium text-[#534AB7] dark:text-indigo-400 hover:underline"
      >
        View full learning path →
      </Link>
    </section>
  );
}
