'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 3: PRACTICE — Question-by-question MCQ with instant feedback.
 * - Uses usePracticeQuestions hook and normaliseChoices from sessionUtils.
 * - TutorTipPanel shown above questions.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ + uses hooks/session +
 *                          sessionUtils + TutorTipPanel (closes Gap #14)
 */

import React, { useState, useCallback } from 'react';
import type { PracticeContent } from '@/lib/session/getPhaseContent';
import type { SubmitActionResult } from '@/lib/session/sessionActions';
import { normaliseChoices } from '@/lib/session/sessionUtils';
import { scoreBgColour } from '@/lib/session/sessionUtils';
import { TutorTipPanel } from '@/components/session/TutorTipPanel';
import { PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';

interface PracticePhaseProps {
  content: PracticeContent;
  topicName?: string;
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>;
  onNext: () => void;
  submitting?: boolean;
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  result,
  onNext,
  loading,
}: {
  result: SubmitActionResult;
  onNext: () => void;
  loading?: boolean;
}) {
  const config = PHASE_UI_CONFIG.PRACTICE;
  const pct = result.percentage;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {pct >= 80 ? 'Well done!' : pct >= 60 ? 'Good effort!' : 'Keep going!'}
        </h2>
      </div>

      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <div className="mt-3 w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${scoreBgColour(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {result.results.map((r, i) => (
          <div
            key={r.questionId}
            className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
              r.isCorrect
                ? 'bg-green-500/5 border border-green-500/15'
                : 'bg-orange-500/5 border border-orange-500/15'
            }`}
          >
            <span className={`font-bold flex-shrink-0 ${r.isCorrect ? 'text-green-600' : 'text-orange-600'}`}>
              {r.isCorrect ? '✓' : '✗'}
            </span>
            <span className="text-muted-foreground">Q{i + 1}</span>
            {!r.isCorrect && r.correctAnswer && (
              <span className="text-muted-foreground">
                Correct: <span className="font-medium text-foreground">{r.correctAnswer}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3">{config.completionNote}</p>
        <button
          onClick={onNext}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <span className="animate-spin">⏳</span> : (
            <>
              <span>{config.ctaLabel}</span>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PracticePhase({ content, topicName, onSubmit, onNext, submitting }: PracticePhaseProps) {
  const questions = content.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [result, setResult] = useState<SubmitActionResult | null>(null);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      const newAnswers = [...answers, { questionId, answer }];
      setAnswers(newAnswers);
      if (currentIndex < questions.length - 1) {
        setTimeout(() => setCurrentIndex((i) => i + 1), 500);
      } else {
        const res = await onSubmit(newAnswers);
        if (res) setResult(res);
      }
    },
    [answers, currentIndex, questions.length, onSubmit],
  );

  if (result) {
    return <ResultsScreen result={result} onNext={onNext} loading={submitting} />;
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Practice questions are being generated. Come back shortly.
      </div>
    );
  }

  const question = questions[currentIndex];
  const choices = normaliseChoices(question.choices);
  const selected = null; // selection state lives in handleAnswer flow

  return (
    <div>
      <TutorTipPanel phase="PRACTICE" topicName={topicName} />
      <div className="max-w-2xl mx-auto px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          {question.difficulty && (
            <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground capitalize">
              {question.difficulty}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < currentIndex ? 'bg-primary' : i === currentIndex ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <p className="text-base font-medium text-foreground mb-5 leading-relaxed">
          {question.prompt}
        </p>

        {choices.length > 0 ? (
          <div className="space-y-2.5">
            {choices.map((choice) => (
              <button
                key={choice.key}
                onClick={() => handleAnswer(question.id, choice.key)}
                disabled={selected !== null}
                className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all text-sm"
              >
                <span className="font-mono text-xs mr-2 uppercase text-muted-foreground">
                  {choice.key})
                </span>
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            placeholder="Type your answer…"
            onBlur={(e) => {
              if (e.target.value.trim()) handleAnswer(question.id, e.target.value.trim());
            }}
            className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        )}
      </div>
    </div>
  );
}

export default PracticePhase;
