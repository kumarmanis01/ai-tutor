/**
 * UpcomingTopicsList
 *
 * Simple list of up to 3 upcoming topics in curriculum order.
 * Provides a path-forward view without overwhelming the student.
 * Includes a "View Full Learning Path" link.
 *
 * Design rules (UX architecture review):
 *   - Plain list, not cards — low visual weight
 *   - Max 3 items shown
 *   - Always has next topics (curriculum always has more)
 *   - Link to full learning path below
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created for upcoming topics on dashboard
 */
import React from 'react';
import Link from 'next/link';

export interface UpcomicTopic {
  topicId: string;
  topicTitle: string;
  subject: string;
}

export interface UpcomingTopicsListProps {
  topics: UpcomicTopic[];
}

export default function UpcomingTopicsList({ topics }: UpcomingTopicsListProps) {
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-topics-heading">
      <h3
        id="upcoming-topics-heading"
        className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3"
      >
        Upcoming
      </h3>

      <ul className="space-y-2">
        {topics.slice(0, 3).map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3 text-sm text-gray-700">
            <span className="text-gray-300" aria-hidden>→</span>
            <span className="truncate">
              {topic.topicTitle}
              {topic.subject && (
                <span className="ml-2 text-xs text-gray-400">{topic.subject}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/learn/learning-path"
        className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        View full learning path →
      </Link>
    </section>
  );
}
