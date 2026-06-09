/**
 * FILE OBJECTIVE:
 * - Collapsible subject block on the learning path page.
 *   Shows subject name, overall completion fraction, and chapter -> topic rows.
 *   Chapter names link to /session/chapter/[chapterId] for on-demand AI sessions.
 *
 * EDIT LOG:
 * - 2026-06-09T14:30:00Z | claude | make chapter name headers link to /session/chapter/[chapterId]
 * - 2026-03-07 | UX implementation | created for learning path page
 */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SubjectLanguageControl from '@/components/student/SubjectLanguageControl';
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
  subjectId,
  subjectName,
  chapters,
  completedTopics,
  totalTopics,
}: SubjectSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="w-full flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
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
                className="h-full rounded-full bg-[#534AB7] transition-all"
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

        <div className="ml-4">
          <SubjectLanguageControl subjectId={subjectId} />
        </div>
      </div>

      {/* Chapter list */}
      {open && (
        <div className="border-t border-gray-100">
          {chapters.map((chapter) => (
            <div key={chapter.chapterId} className="px-5 py-3 border-b border-gray-50 last:border-0">
              <Link
                href={`/session/chapter/${chapter.chapterId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded min-h-[44px] sm:min-h-0"
                aria-label={`Start ${chapter.chapterName} chapter session`}
              >
                {chapter.chapterName}
                <span className="text-[10px] text-primary/60 normal-case tracking-normal font-normal">→</span>
              </Link>
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
