/**
 * FILE OBJECTIVE:
 * - Main client shell for on-demand chapter sessions. Provides 5 tabs:
 *   Topics (auto-generates on mount), Syllabus (manual trigger), Practice,
 *   Quiz, and Homework (each with difficulty + count controls).
 *   Nothing is persisted -- all content is generated on-demand and streamed.
 *
 * EDIT LOG:
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session page
 */

'use client';

import React, { useState, useCallback } from 'react';
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

// ─── Tabs config ──────────────────────────────────────────────────────────────

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
        onToken: (token) => setContent((prev) => prev + token),
        onDone: () => {
          setIsGenerating(false);
          setHasGenerated(true);
        },
        onError: (msg) => {
          setIsGenerating(false);
          if (msg === 'daily_limit_reached') {
            setError("You've reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setError("Couldn't generate syllabus -- tap to retry.");
          }
        },
      },
    );
  }, [abort, stream, chapterName, subject, grade, board]);

  if (!hasGenerated && !isGenerating && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Generate a complete syllabus for this chapter including learning objectives,
          key concepts, and expected outcomes.
        </p>
        <Button variant="primary" onClick={handleGenerate} className="min-h-[44px]">
          Generate Syllabus
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasGenerated && !error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block w-1.5 h-1.5 bg-primary animate-pulse rounded-full"
            aria-hidden="true"
          />
          Generating syllabus...
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
        ) : (
          <div className="space-y-2">
            <div className="h-3 loader-shimmer rounded w-full" aria-hidden="true" />
            <div className="h-3 loader-shimmer rounded w-5/6" aria-hidden="true" />
            <div className="h-3 loader-shimmer rounded w-4/5" aria-hidden="true" />
          </div>
        )}
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
    <div className="w-full max-w-2xl mx-auto px-4 pb-12">
      {/* Chapter header */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">
          {board} · Grade {grade} · {subjectName}
        </p>
        <h1 className="text-xl font-semibold text-foreground leading-tight">{chapterName}</h1>
        {topicCount > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{topicCount} topics</p>
        )}
        <p className="text-xs text-primary mt-1 font-medium">
          AI-powered -- content is generated on demand
        </p>
      </div>

      {/* Tab strip */}
      <div
        className="flex flex-wrap gap-2 mb-6"
        role="tablist"
        aria-label="Chapter content type"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full min-h-[44px] sm:min-h-0"
          >
            <Pill intent={activeTab === tab.key ? 'primary' : 'ghost'}>{tab.label}</Pill>
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
