/**
 * FILE OBJECTIVE:
 * - Reusable chapter node card for S2.1 learning map states.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/ChapterNode.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 chapter node component
 * - 2026-04-25T00:30:00Z | copilot | removed inline style for progress width and switched to width utility classes
 * - 2026-04-25T01:45:00Z | copilot | added completed-chapter practice affordance
 */

'use client';

import React from 'react';
import type { LearningMapNode } from '@/hooks/useLearningMap';

type ChapterNodeProps = {
  node: LearningMapNode;
  onClick: (node: LearningMapNode) => void;
  onPractice?: (node: LearningMapNode) => void;
};

function nodeStyles(state: LearningMapNode['state']): string {
  if (state === 'completed') return 'border-[#1D9E75] bg-[#EAF3DE] text-[#1D9E75]';
  if (state === 'current') {
    return 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7] animate-[pulse_2.4s_ease-in-out_infinite]';
  }
  if (state === 'premium-locked') return 'border-gray-300 bg-gray-100 text-gray-500';
  return 'border-gray-300 bg-gray-50 text-gray-500';
}

function nodeIcon(state: LearningMapNode['state']): string {
  if (state === 'completed') return '✓';
  if (state === 'current') return '●';
  if (state === 'premium-locked') return '👑';
  return '🔒';
}

function progressWidthClass(percent: number): string {
  const bucket = Math.max(0, Math.min(100, Math.round(percent / 5) * 5));
  return `w-pct-${bucket}`;
}

export function ChapterNode({ node, onClick, onPractice }: ChapterNodeProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      className={`min-w-[220px] max-w-[240px] rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5 ${nodeStyles(node.state)}`}
      aria-label={`${node.chapterName} (${node.state})`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide">{node.subjectName}</p>
        <span className="text-base" aria-hidden="true">
          {nodeIcon(node.state)}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-bold leading-snug">{node.chapterName}</h3>
      <p className="mt-2 text-xs opacity-90">
        {node.completedTopics}/{node.topicsCount} topics complete
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full rounded-full bg-current transition-all ${progressWidthClass(
            node.completionPercent
          )}`}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-medium">Score: {node.scorePercent}%</p>
        <div className="flex items-center gap-2">
          {node.state === 'completed' && node.previewTopicId && onPractice && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onPractice(node);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onPractice(node);
                }
              }}
              className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-semibold"
            >
              Practice
            </span>
          )}
          {node.ctaLabel && <p className="text-xs font-semibold">{node.ctaLabel} →</p>}
        </div>
      </div>
    </button>
  );
}

export default ChapterNode;
