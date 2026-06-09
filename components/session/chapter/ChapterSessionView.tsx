/**
 * FILE OBJECTIVE:
 * - Main client shell for chapter sessions. Five tabs: Syllabus (AI overview),
 *   Topics (AI-generated topic list), Practice, Quiz, Homework (AI questions with
 *   topic dropdown, difficulty slider, count stepper). No sidebar -- topic selection
 *   is via dropdown within each question tab. All content is AI-generated on demand.
 *
 * EDIT LOG:
 * - 2026-06-09T19:30:00Z | claude | correct 5-tab structure: Syllabus, Topics, Practice,
 *     Quiz, Homework; topic dropdown in question tabs; no sidebar
 * - 2026-06-09T19:00:00Z | claude | pipeline-backed streaming tabs
 * - 2026-06-09T16:00:00Z | claude | design-system tokens, dashboard chrome
 * - 2026-06-09T12:00:00Z | claude | initial implementation
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Pill, Card } from '@/components/UI/design-system';
import { ChapterStreamPanel } from './ChapterStreamPanel';
import { TopicQuestionsPanel, type TopicOption } from './TopicQuestionsPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'syllabus' | 'topics' | 'exercises' | 'quiz' | 'homework';

interface ChapterSessionViewProps {
  chapterId: string;
  chapterName: string;
  subjectName: string;
  grade: string;
  board: string;
  /** Topics from DB (structural only -- names for the dropdown) */
  topics: TopicOption[];
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'syllabus',   label: 'Syllabus' },
  { key: 'topics',     label: 'Topics' },
  { key: 'exercises',  label: 'Practice' },
  { key: 'quiz',       label: 'Quiz' },
  { key: 'homework',   label: 'Homework' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function ChapterSessionView({
  chapterName,
  subjectName,
  grade,
  board,
  topics,
}: ChapterSessionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('syllabus');

  const ctx = { chapterName, subject: subjectName, grade, board };

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-4 space-y-5">
      {/* Back link */}
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
        aria-label="Back to learning path"
      >
        <span aria-hidden="true">&#8592;</span>
        <span>{subjectName}</span>
      </Link>

      {/* Chapter hero */}
      <Card variant="hero" padding="normal">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill intent="primary">{subjectName}</Pill>
            <Pill intent="ghost">{board} · Grade {grade}</Pill>
            {topics.length > 0 && (
              <Pill intent="ghost">{topics.length} topics</Pill>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mt-2">
            {chapterName}
          </h1>
        </div>
      </Card>

      {/* Tab strip */}
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Chapter content tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              'min-h-[44px] sm:min-h-0',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" aria-label={activeTab}>

        {activeTab === 'syllabus' && (
          <ChapterStreamPanel
            key="syllabus"
            request={{ ...ctx, contentType: 'syllabus' }}
            autoGenerate
          />
        )}

        {activeTab === 'topics' && (
          <ChapterStreamPanel
            key="topics"
            request={{ ...ctx, contentType: 'topics' }}
            autoGenerate
          />
        )}

        {activeTab === 'exercises' && (
          <TopicQuestionsPanel
            key="exercises"
            {...ctx}
            topics={topics}
            mode="exercises"
          />
        )}

        {activeTab === 'quiz' && (
          <TopicQuestionsPanel
            key="quiz"
            {...ctx}
            topics={topics}
            mode="quiz"
          />
        )}

        {activeTab === 'homework' && (
          <TopicQuestionsPanel
            key="homework"
            {...ctx}
            topics={topics}
            mode="homework"
          />
        )}
      </div>
    </div>
  );
}
