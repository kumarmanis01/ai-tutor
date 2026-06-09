/**
 * FILE OBJECTIVE:
 * - Questions panel for chapter session Practice / Quiz / Homework tabs.
 *   Topic dropdown populated from the chapter's topic list.
 *   Toughness slider (1-5), count stepper (- N +), and Generate button.
 *   Streams AI content via ChapterStreamPanel using questionsSlice prompts.
 *
 * EDIT LOG:
 * - 2026-06-09T19:30:00Z | claude | add topic dropdown; redesign for 5-tab chapter session
 * - 2026-06-09T19:00:00Z | claude | initial implementation
 */

'use client';

import React, { useState } from 'react';
import { ChapterStreamPanel } from './ChapterStreamPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type DiffLevel = 1 | 2 | 3 | 4 | 5;

const LEVEL_LABELS: Record<DiffLevel, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very Hard',
};

export interface TopicOption {
  id: string;
  name: string;
}

interface TopicQuestionsPanelProps {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
  /** Topic list from DB structural query -- used to populate the dropdown */
  topics: TopicOption[];
  mode: 'exercises' | 'quiz' | 'homework';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicQuestionsPanel({
  chapterName,
  subject,
  grade,
  board,
  topics,
  mode,
}: TopicQuestionsPanelProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(
    topics.length > 0 ? topics[0].name : '',
  );
  const [level, setLevel] = useState<DiffLevel>(3);
  const [count, setCount] = useState(5);

  const modeLabel = mode === 'quiz' ? 'Quiz' : mode === 'homework' ? 'Homework' : 'Exercises';
  const contentType = mode; // matches route enum

  // Key forces ChapterStreamPanel to reset when any setting changes
  const requestKey = `${selectedTopic}-${contentType}-${level}-${count}`;

  const controls = (
    <>
      {/* Topic dropdown */}
      <div className="flex items-start gap-3">
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0 pt-2">Topic</span>
        {topics.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No topics available</p>
        ) : (
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="flex-1 text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Select topic"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Toughness slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Toughness</span>
        <input
          type="range"
          min={1}
          max={5}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value) as DiffLevel)}
          className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
          aria-label="Question difficulty level"
        />
        <span className="text-xs font-semibold text-foreground w-20 text-right flex-shrink-0 tabular-nums">
          {level} · {LEVEL_LABELS[level]}
        </span>
      </div>

      {/* Count stepper */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Count</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease question count"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="w-8 h-8 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
          >
            −
          </button>
          <span className="text-sm font-semibold text-foreground w-6 text-center tabular-nums">
            {count}
          </span>
          <button
            type="button"
            aria-label="Increase question count"
            onClick={() => setCount((c) => Math.min(15, c + 1))}
            className="w-8 h-8 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
          >
            +
          </button>
        </div>
      </div>
    </>
  );

  return (
    <ChapterStreamPanel
      key={requestKey}
      request={{
        chapterName,
        subject,
        grade,
        board,
        contentType,
        topicTitle: selectedTopic || chapterName,
        difficulty: level,
        count,
      }}
      autoGenerate={false}
      controls={controls}
      generateLabel={`Generate ${count} ${modeLabel}`}
    />
  );
}
