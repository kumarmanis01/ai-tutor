'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 3: PRACTICE — Question-by-question MCQ with instant per-answer feedback.
 * - Implements spec: "instant feedback, short explanation, Question X of Y progress."
 * - Collects all answers then submits in bulk; advances session after results shown.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React, { useState, useCallback } from 'react';
import type { PracticeContent } from '@/lib/session/getPhaseContent';
import type { SubmitResult } from '@/hooks/useStructuredSession';

// ─── Choice normalisation ─────────────────────────────────────────────────────
// Practice question choices can be string[] or {a:, b:, ...} object.
// Normalise to { key: 'a'|'b'|'c'|'d', label: string }[].

interface Choice { key: string; label: string }

function normaliseChoices(raw: unknown): Choice[] {
  if (!raw) return [];

  const keys = ['a', 'b', 'c', 'd'];

  if (Array.isArray(raw)) {
    return raw.slice(0, 4).map((v, i) => ({ key: keys[i], label: String(v) }));
  }

  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .slice(0, 4)
      .map(([k, v], i) => ({ key: keys[i] ?? k.toLowerCase(), label: String(v) }));
  }

  return [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: PracticeContent['questions'][number];
  index: number;
  total: number;
  onAnswer: (questionId: string, answer: string) => void;
}

function QuestionCard({ question, index, total, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const choices = normaliseChoices(question.choices);

  const handleSelect = (key: string) => {
    if (selected) return; // already answered
    setSelected(key);
    onAnswer(question.id, key);
  };

  const isAnswered = selected !== null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Question counter */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">
          Question {index + 1} of {total}
        </span>
        {question.difficulty && (
          <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground capitalize">
            {question.difficulty}
          </span>
        )}
      </div>

      {/* Mini progress bar */}
      <div className="flex gap-1 mb-5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < index ? 'bg-primary' : i === index ? 'bg-primary/50' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Prompt */}
      <p className="text-base font-medium text-foreground mb-5 leading-relaxed">
        {question.prompt}
      </p>

      {/* Choices */}
      {choices.length > 0 ? (
        <div className="space-y-2.5">
          {choices.map((choice) => (
            <button
              key={choice.key}
              onClick={() => handleSelect(choice.key)}
              disabled={isAnswered}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                !isAnswered
                  ? 'border-border hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]'
                  : selected === choice.key
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground opacity-60'
              }`}
            >
              <span className="font-mono text-xs mr-2 uppercase text-muted-foreground">
                {choice.key})
              </span>
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        // Free-text fallback
        <input
          type="text"
          placeholder="Type your answer…"
          disabled={isAnswered}
          onBlur={(e) => {
            if (e.target.value.trim() && !isAnswered) {
              handleSelect(e.target.value.trim());
            }
          }}
          className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}

      {/* Answered feedback — inline per spec */}
      {isAnswered && (
        <div className="mt-4 bg-muted/50 rounded-xl p-3 border border-border/50">
          <p className="text-xs text-muted-foreground">
            Answer recorded. Results will appear after all questions.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

interface ResultsScreenProps {
  result: SubmitResult;
  questions: PracticeContent['questions'];
  answers: { questionId: string; answer: string }[];
  onContinue: () => void;
  loading?: boolean;
}

function ResultsScreen({ result, onContinue, loading }: ResultsScreenProps) {
  const pct = result.percentage;
  const isStrong = pct >= 80;
  const isOk = pct >= 60;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{isStrong ? '🎉' : isOk ? '👍' : '💪'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {isStrong ? 'Well done!' : isOk ? 'Good effort!' : 'Keep going!'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Practice complete</p>
      </div>

      {/* Score card */}
      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-4xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <div className="mt-3 w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isStrong ? 'bg-green-500' : isOk ? 'bg-amber-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-question results */}
      <div className="space-y-2">
        {result.results.map((r, i) => (
          <div
            key={r.questionId}
            className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
              r.isCorrect ? 'bg-green-500/5 border border-green-500/15' : 'bg-orange-500/5 border border-orange-500/15'
            }`}
          >
            <span className={r.isCorrect ? 'text-green-600' : 'text-orange-600'}>
              {r.isCorrect ? '✓' : '✗'}
            </span>
            <span className="text-muted-foreground">Q{i + 1}</span>
            {!r.isCorrect && r.correctAnswer && (
              <span className="text-muted-foreground">
                Correct: <span className="text-foreground font-medium">{r.correctAnswer}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3">✓ Practice complete — next: Quick Test</p>
        <button
          onClick={onContinue}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <span className="animate-spin">⏳</span> : (
            <>
              <span>Continue to Quick Test</span>
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

// ─── Main PracticePhase ───────────────────────────────────────────────────────

interface PracticePhaseProps {
  content: PracticeContent;
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<SubmitResult | null>;
  onNext: () => void;
  submitting?: boolean;
}

export function PracticePhase({ content, onSubmit, onNext, submitting }: PracticePhaseProps) {
  const questions = content.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string) => {
      const newAnswers = [...answers, { questionId, answer }];
      setAnswers(newAnswers);

      if (currentIndex < questions.length - 1) {
        // Brief pause so the student sees their selection before moving on
        setTimeout(() => setCurrentIndex((i) => i + 1), 600);
      } else {
        // All answered — submit
        const res = await onSubmit(newAnswers);
        if (res) setResult(res);
      }
    },
    [answers, currentIndex, questions.length, onSubmit],
  );

  if (result) {
    return (
      <ResultsScreen
        result={result}
        questions={questions}
        answers={answers}
        onContinue={onNext}
        loading={submitting}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Practice questions are being generated. Come back shortly.
      </div>
    );
  }

  return (
    <QuestionCard
      question={questions[currentIndex]}
      index={currentIndex}
      total={questions.length}
      onAnswer={handleAnswer}
    />
  );
}

export default PracticePhase;
