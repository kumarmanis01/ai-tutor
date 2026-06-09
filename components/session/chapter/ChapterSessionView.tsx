/**
 * FILE OBJECTIVE:
 * - Main client shell for on-demand chapter sessions. Five tabs: Topics
 *   (auto-generates on mount), Syllabus (manual), Practice, Quiz, Homework.
 *   Uses design-system primitives and brand tokens throughout.
 *
 * EDIT LOG:
 * - 2026-06-09T16:00:00Z | claude | full redesign: proper tokens, Card/Pill/Button primitives, dashboard chrome
 * - 2026-06-09T12:00:00Z | claude | initial implementation
 */

'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Pill, Card, Button } from '@/components/UI/design-system';
import { TopicList } from './TopicList';
import { ChapterGeneratePanel } from './ChapterGeneratePanel';
import { useStream } from '@/hooks/useStream';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'topics' | 'syllabus' | 'practice' | 'quiz' | 'homework';

interface ChapterSessionViewProps {
  chapterId: string;
  chapterName: string;
  subjectName: string;
  grade: string;
  board: string;
  topicCount: number;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'topics', label: 'Topics' },
  { key: 'syllabus', label: 'Syllabus' },
  { key: 'practice', label: 'Practice' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'homework', label: 'Homework' },
];

// ─── Syllabus panel ───────────────────────────────────────────────────────────

interface SyllabusPanelProps {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
}

function SyllabusPanel({ chapterName, subject, grade, board }: SyllabusPanelProps) {
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { stream, abort } = useStream();

  const handleGenerate = useCallback(() => {
    abort();
    setContent('');
    setError(null);
    setIsGenerating(true);

    stream(
      '/api/chapter/generate',
      { chapterName, subject, grade, board, contentType: 'syllabus' },
      {
        onToken: (token) => setContent((prev: string) => prev + token),
        onDone: () => {
          setIsGenerating(false);
          setHasGenerated(true);
        },
        onError: (msg) => {
          setIsGenerating(false);
          setError(
            msg === 'daily_limit_reached'
              ? "You've reached your daily limit. Come back tomorrow -- your best is still ahead."
              : "Couldn't generate syllabus -- tap to retry.",
          );
        },
      },
    );
  }, [abort, stream, chapterName, subject, grade, board]);

  if (!hasGenerated && !isGenerating && !error) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            Generate the complete syllabus for this chapter -- learning objectives,
            key concepts, and expected outcomes.
          </p>
          <Button variant="primary" onClick={handleGenerate} className="min-h-[44px]">
            Generate Syllabus
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {isGenerating && !content && (
        <div className="space-y-3" role="status" aria-label="Generating syllabus">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-3 loader-shimmer rounded w-full" aria-hidden="true" />
          ))}
        </div>
      )}

      <Card padding="compact">
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-error">{error}</p>
            <button
              type="button"
              onClick={handleGenerate}
              className="text-xs text-primary underline min-h-[44px] sm:min-h-0"
            >
              Tap to retry
            </button>
          </div>
        ) : content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isGenerating && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm"
                aria-hidden="true"
              />
            )}
          </div>
        ) : null}
      </Card>

      {hasGenerated && (
        <button
          type="button"
          onClick={handleGenerate}
          className="text-xs text-muted-foreground underline min-h-[44px] sm:min-h-0"
        >
          Regenerate
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChapterSessionView({
  chapterName,
  subjectName,
  grade,
  board,
  topicCount,
}: ChapterSessionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('topics');

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-4 space-y-5">
      {/* Back link */}
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
        aria-label="Back to learn"
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
            {topicCount > 0 && (
              <Pill intent="ghost">{topicCount} topics</Pill>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug mt-2">
            {chapterName}
          </h1>
          <p className="text-xs text-primary font-medium mt-0.5">
            AI-powered -- everything generated on demand
          </p>
        </div>
      </Card>

      {/* Tab strip */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Chapter content tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full min-h-[44px] sm:min-h-0"
          >
            <Pill intent={activeTab === tab.key ? 'primary' : 'ghost'}>
              {tab.label}
            </Pill>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" aria-label={activeTab}>
        {activeTab === 'topics' && (
          <TopicList
            chapterName={chapterName}
            subject={subjectName}
            grade={grade}
            board={board}
          />
        )}

        {activeTab === 'syllabus' && (
          <SyllabusPanel
            chapterName={chapterName}
            subject={subjectName}
            grade={grade}
            board={board}
          />
        )}

        {activeTab === 'practice' && (
          <ChapterGeneratePanel
            chapterName={chapterName}
            subject={subjectName}
            grade={grade}
            board={board}
            contentType="practice"
          />
        )}

        {activeTab === 'quiz' && (
          <ChapterGeneratePanel
            chapterName={chapterName}
            subject={subjectName}
            grade={grade}
            board={board}
            contentType="quiz"
          />
        )}

        {activeTab === 'homework' && (
          <ChapterGeneratePanel
            chapterName={chapterName}
            subject={subjectName}
            grade={grade}
            board={board}
            contentType="homework"
          />
        )}
      </div>
    </div>
  );
}
