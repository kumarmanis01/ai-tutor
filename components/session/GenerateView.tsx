/**
 * FILE OBJECTIVE:
 * - Client-side view for demand-pull content generation within a session.
 *   Provides content-type tabs (Curriculum/Concepts/Examples/Quiz/Exercises),
 *   GenerateControls for configurable generation, and a streaming output area.
 *   Also shows a stat bar sourced from TopicProgress above the controls.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | lift difficulty state; replace static concepts with ConceptCard for Deep Dive (task S3-1)
 * - 2026-06-09T00:00:00Z | claude | initial implementation for demand-pull generate flow (task S3)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Pill, Card } from '@/components/UI/design-system';
import { GenerateControls } from './GenerateControls';
import type { ContentType, GenerateParams } from './GenerateControls';
import type { ConceptOption } from './ConceptSelector';
import type { ToughnessRecommendation } from '@/lib/mastery/topicProgress';
import { useStream } from '@/hooks/useStream';
import { ConceptCard } from './ConceptCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'curriculum' | 'concepts' | 'examples' | 'quiz' | 'exercises';

interface StatBarProps {
  attempts: number;
  score: number;
  state: string;
}

interface GenerateViewProps {
  topicSlug: string;
  topicTitle: string;
  subject: string;
  grade: string;
  board: string;
  concepts: ConceptOption[];
  recommendation: ToughnessRecommendation;
  stats: StatBarProps;
  curriculumSummary?: string;
}

// ─── Stat bar ─────────────────────────────────────────────────────────────────

function StatBar({ attempts, score, state }: StatBarProps) {
  const masteryPct = Math.round(score * 100);
  const stateLabel = state === 'MASTERED' ? 'Mastered' : state === 'DEVELOPING' ? 'Developing' : 'Not started';

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Topic stats">
      <span>
        <span className="font-medium text-foreground">{masteryPct}%</span> mastery
      </span>
      <span>
        <span className="font-medium text-foreground">{attempts}</span> {attempts === 1 ? 'attempt' : 'attempts'}
      </span>
      <span>
        <span className="font-medium text-foreground">{stateLabel}</span>
      </span>
    </div>
  );
}

// ─── Tab strip ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'examples', label: 'Examples' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'exercises', label: 'Exercises' },
];

const GENERATE_TABS: TabKey[] = ['examples', 'quiz', 'exercises'];

// ─── Main component ────────────────────────────────────────────────────────────

export function GenerateView({
  topicSlug,
  topicTitle,
  subject,
  grade,
  board,
  concepts,
  recommendation,
  stats,
  curriculumSummary,
}: GenerateViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('examples');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Difficulty is lifted here so ConceptCards can receive it and reset when it changes.
  const [difficulty, setDifficulty] = useState(recommendation.toughness);
  const { stream, abort } = useStream();

  const handleGenerate = useCallback(
    (params: GenerateParams) => {
      abort();
      setGeneratedContent('');
      setGenerateError(null);
      setIsGenerating(true);

      stream('/api/generate', params, {
        onToken: (token) => setGeneratedContent((prev) => prev + token),
        onDone: () => setIsGenerating(false),
        onError: (msg) => {
          setIsGenerating(false);
          if (msg === 'daily_limit_reached') {
            setGenerateError("You have reached your daily limit. Come back tomorrow -- your best is still ahead.");
          } else {
            setGenerateError("Couldn't generate content -- tap to retry.");
          }
        },
      });
    },
    [stream, abort],
  );

  const activeContentType = GENERATE_TABS.includes(activeTab) ? (activeTab as ContentType) : 'examples';

  return (
    <div className="w-full space-y-4">
      {/* Stat bar */}
      <StatBar {...stats} />

      {/* Tab strip */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Content type">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full min-h-[44px] sm:min-h-0"
          >
            <Pill
              intent={activeTab === tab.key ? 'primary' : 'ghost'}
            >
              {tab.label}
            </Pill>
          </button>
        ))}
      </div>

      {/* Curriculum tab */}
      {activeTab === 'curriculum' && (
        <Card padding="compact">
          {curriculumSummary ? (
            <p className="text-sm text-foreground leading-relaxed">{curriculumSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Curriculum notes for {topicTitle} will appear here.
            </p>
          )}
        </Card>
      )}

      {/* Concepts tab */}
      {activeTab === 'concepts' && (
        <div className="space-y-3">
          {concepts.length > 0 ? (
            concepts.map((c) => (
              <ConceptCard
                key={c.id}
                concept={c}
                topicSlug={topicSlug}
                subject={subject}
                grade={grade}
                board={board}
                difficulty={difficulty}
              />
            ))
          ) : (
            <Card padding="compact">
              <p className="text-sm text-muted-foreground italic">
                Concepts for this topic are being prepared.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Examples / Quiz / Exercises tabs */}
      {GENERATE_TABS.includes(activeTab) && (
        <div className="space-y-4">
          <GenerateControls
            concepts={concepts}
            contentType={activeContentType}
            topicSlug={topicSlug}
            subject={subject}
            grade={grade}
            board={board}
            recommendation={recommendation}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            onDifficultyChange={setDifficulty}
          />

          {/* Generated output area */}
          <Card padding="compact">
            {generateError ? (
              <div className="space-y-2">
                <p className="text-sm text-error">{generateError}</p>
                <button
                  type="button"
                  onClick={() => setGenerateError(null)}
                  className="text-xs text-primary underline min-h-[44px] sm:min-h-0"
                >
                  Dismiss
                </button>
              </div>
            ) : generatedContent ? (
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {generatedContent}
                {isGenerating && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm" aria-hidden="true" />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Your {activeTab} will appear here. Configure above and tap Generate.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
