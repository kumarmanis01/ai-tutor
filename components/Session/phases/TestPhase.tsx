'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 4: TEST — All questions shown at once; no hints; submit at end.
 * - Implements spec: "Try without hints. You will see explanations after the test."
 * - After submit shows score, strength/weakness labels, mastery level.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React, { useState } from 'react';
import type { TestContent } from '@/lib/session/getPhaseContent';
import type { SubmitResult } from '@/hooks/useStructuredSession';

// ─── Choice normalisation (mirrors PracticePhase) ─────────────────────────────

interface Choice { key: string; label: string }

function normaliseOptions(raw: unknown): Choice[] {
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

// ─── Results Screen ───────────────────────────────────────────────────────────

interface TestResultsProps {
  result: SubmitResult;
  onContinue: () => void;
  loading?: boolean;
}

function TestResults({ result, onContinue, loading }: TestResultsProps) {
  const pct = result.percentage;
  const isStrong = pct >= 80;
  const isOk = pct >= 50;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{isStrong ? '🏆' : isOk ? '👍' : '💪'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {isStrong ? 'Great job!' : isOk ? 'Good effort!' : 'Nice try!'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Test complete</p>
      </div>

      {/* Score */}
      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-5xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <div className="mt-3 w-full bg-muted rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${isStrong ? 'bg-green-500' : isOk ? 'bg-amber-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Strength / Needs improvement labels */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Correct</p>
          <p className="text-xl font-bold text-green-600">{result.correctAnswers}</p>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Needs review</p>
          <p className="text-xl font-bold text-orange-600">
            {result.totalAnswers - result.correctAnswers}
          </p>
        </div>
      </div>

      {/* Per-question results with correct answers shown */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Question breakdown</h3>
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
            <div>
              <span className="text-muted-foreground">Q{i + 1} — </span>
              {r.isCorrect ? (
                <span className="text-green-700 dark:text-green-400">Correct</span>
              ) : (
                <span className="text-foreground">
                  Correct answer:{' '}
                  <span className="font-medium">{r.correctAnswer ?? 'See notes'}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3">✓ Test complete — next: Homework</p>
        <button
          onClick={onContinue}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <span className="animate-spin">⏳</span> : (
            <>
              <span>Continue to Homework</span>
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

// ─── Main TestPhase ───────────────────────────────────────────────────────────

interface TestPhaseProps {
  content: TestContent;
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<SubmitResult | null>;
  onNext: () => void;
  submitting?: boolean;
}

export function TestPhase({ content, onSubmit, onNext, submitting }: TestPhaseProps) {
  const questions = content.questions;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submittingLocal, setSubmittingLocal] = useState(false);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (questionId: string, key: string) => {
    if (result) return;
    setAnswers((a) => ({ ...a, [questionId]: key }));
  };

  const handleSubmit = async () => {
    setSubmittingLocal(true);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    const res = await onSubmit(payload);
    if (res) setResult(res);
    setSubmittingLocal(false);
  };

  if (result) {
    return <TestResults result={result} onContinue={onNext} loading={submitting} />;
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Test questions are being prepared. Come back shortly.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Test intro */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">📝</span>
          <div>
            <p className="font-semibold text-sm text-foreground mb-1">Quick Test</p>
            <p className="text-xs text-muted-foreground">
              {questions.length} questions · Try without hints · You&apos;ll see answers after submitting
            </p>
          </div>
        </div>
      </div>

      {/* Answer progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {answeredCount} of {questions.length} answered
        </span>
        <div className="flex gap-1">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`w-2 h-2 rounded-full ${answers[q.id] ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      {/* All questions */}
      <div className="space-y-6">
        {questions.map((question, i) => {
          const choices = normaliseOptions(question.options);
          const selected = answers[question.id];

          return (
            <div key={question.id} className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-2">Q{i + 1}</p>
              <p className="text-sm font-medium text-foreground mb-4 leading-relaxed">
                {question.question}
              </p>

              {choices.length > 0 ? (
                <div className="space-y-2">
                  {choices.map((choice) => (
                    <button
                      key={choice.key}
                      onClick={() => handleSelect(question.id, choice.key)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${
                        selected === choice.key
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/30 hover:bg-primary/5'
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
                <input
                  type="text"
                  placeholder="Type your answer…"
                  value={answers[question.id] ?? ''}
                  onChange={(e) => handleSelect(question.id, e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submittingLocal}
        className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
      >
        {submittingLocal ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <>
            <span>Submit Test</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>
      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">
          Answer all {questions.length} questions to submit
        </p>
      )}
    </div>
  );
}

export default TestPhase;
