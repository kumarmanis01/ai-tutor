/**
 * FILE OBJECTIVE:
 * - Dashboard widget listing up to 5 weak topics (mastery < 0.4).
 * - Each topic has a "Practice Now" button linking to the practice flow.
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | created for weak-topics dashboard feature
 */
import React from 'react';
import Link from 'next/link';

export interface WeakTopic {
  topicId: string;
  topicName: string;
  mastery: number;
}

export interface WeakTopicsCardProps {
  topics: WeakTopic[];
}

export default function WeakTopicsCard({ topics }: WeakTopicsCardProps) {
  if (topics.length === 0) {
    return null;
  }

  return (
    <section
      className="bg-white rounded-lg border p-6"
      aria-labelledby="weak-topics-heading"
    >
      <h3 id="weak-topics-heading" className="text-lg font-semibold text-gray-900 mb-4">
        Weak Topics
      </h3>

      <ul className="space-y-3">
        {topics.map((topic) => (
          <li
            key={topic.topicId}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm text-gray-800 truncate">{topic.topicName}</span>
            <Link
              href={`/practice/start?topicId=${topic.topicId}`}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Practice
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
