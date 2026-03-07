/**
 * SubjectSection
 *
 * Collapsible subject block on the learning path page.
 * Shows subject name, overall completion fraction, and chapter → topic rows.
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created for learning path page
 */
'use client';

import React, { useState } from 'react';
import TopicStatusRow from './TopicStatusRow';
import { getMasteryLabel, getTopicStatus } from '@/lib/learning/masteryLabel';

export interface TopicEntry {
  topicId: string;
  topicName: string;
  mastery: number | null;
  isInProgress?: boolean;
  sessionId?: string;
}

export interface ChapterEntry {
  chapterId: string;
  chapterName: string;
  topics: TopicEntry[];
}

export interface SubjectSectionProps {
  subjectId: string;
  subjectName: string;
  chapters: ChapterEntry[];
  completedTopics: number;
  totalTopics: number;
}

export default function SubjectSection({
  subjectName,
  chapters,
  completedTopics,
  totalTopics,
}: SubjectSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Subject header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">{subjectName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {completedTopics} of {totalTopics} topics complete
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Compact progress bar */}
          <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{
                width: totalTopics > 0
                  ? `${Math.round((completedTopics / totalTopics) * 100)}%`
                  : '0%',
              }}
            />
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Chapter list */}
      {open && (
        <div className="border-t border-gray-100">
          {chapters.map((chapter) => (
            <div key={chapter.chapterId} className="px-5 py-3 border-b border-gray-50 last:border-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {chapter.chapterName}
              </h3>
              <ul>
                {chapter.topics.map((topic) => {
                  const status = getTopicStatus(topic.mastery, topic.isInProgress);
                  const label = getMasteryLabel(topic.mastery);
                  return (
                    <TopicStatusRow
                      key={topic.topicId}
                      topicId={topic.topicId}
                      topicName={topic.topicName}
                      status={status}
                      masteryLabel={status === 'upcoming' ? 'Upcoming' : label}
                      sessionId={topic.sessionId}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
