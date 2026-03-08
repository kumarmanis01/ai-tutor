'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 4: TEST — All questions at once, no hints, submit at end.
 * - Uses useTestQuestions hook for answers state management.
 * - TutorTipPanel shown with test-specific tips.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ + uses useTestQuestions hook
 */

import React, { useState } from 'react';
import type { TestContent } from '@/lib/session/getPhaseContent';
import type { SubmitActionResult } from '@/lib/session/sessionActions';
import { normaliseChoices, scoreBgColour } from '@/lib/session/sessionUtils';
import { useTestQuestions } from '@/hooks/session/useTestQuestions';
import { TutorTipPanel } from '@/components/session/TutorTipPanel';
import { PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';

interface TestPhaseProps {
  content: TestContent;
  topicName?: string;
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>;
  onNext: () => void;
  submitting?: boolean;
}

function TestResults({
  result,
  onNext,
  loading,
}: { result: SubmitActionResult; onNext: () => void; loading?: boolean }) {
  const config = PHASE_UI_CONFIG.TEST;
  const pct = result.percentage;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {pct >= 80 ? 'Great job!' : pct >= 50 ? 'Good effort!' : 'Nice try!'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Test complete</p>
      </div>

      <div className="bg-card rounded-xl border p-5 text-center">
        <div className="text-5xl font-bold text-foreground mb-1">{pct}%</div>
        <p className="text-sm text-muted-foreground">
          {result.correctAnswers} of {result.totalAnswers} correct
        </p>
        <div className="mt-3 w-full bg-muted rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${scoreBgColour(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

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

      <div className="space-y-2">
        {result.results.map((r, i) => (
          <div
            key={r.questionId}
            className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
              r.isCorrect ? 'bg-green-500/5 border border-green-500/15' : 'bg-orange-500/5 border border-orange-500/15'
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
                <span>Correct: <span className="font-medium text-foreground">{r.correctAnswer ?? 'See notes'}</span></span>
              )}
            </div>
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

export function TestPhase({ content, topicName, onSubmit, onNext, submitting }: TestPhaseProps) {
  const { questions, isEmpty, answers, setAnswer, allAnswered } = useTestQuestions(content);
  const [result, setResult] = useState<SubmitActionResult | null>(null);
  const [submittingLocal, setSubmittingLocal] = useState(false);

  const handleSubmit = async () => {
    setSubmittingLocal(true);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer: answer as string }));
    const res = await onSubmit(payload);
    if (res) setResult(res);
    setSubmittingLocal(false);
  };

  if (result) return <TestResults result={result} onNext={onNext} loading={submitting} />;

  if (isEmpty) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Test questions are being prepared. Come back shortly.
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <TutorTipPanel phase="TEST" topicName={topicName} />
      <div className="max-w-2xl mx-auto px-4 pb-6 space-y-6">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">📝</span>
            <div>
              <p className="font-semibold text-sm text-foreground mb-1">Quick Test</p>
              <p className="text-xs text-muted-foreground">
                {questions.length} questions · Try without hints · Answers shown after submitting
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{answeredCount} of {questions.length} answered</span>
          <div className="flex gap-1">
            {questions.map((q) => (
              <div key={q.id} className={`w-2 h-2 rounded-full ${answers[q.id] ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((question, i) => {
            const choices = normaliseChoices(question.options);
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
                        onClick={() => setAnswer(question.id, choice.key)}
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
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submittingLocal}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {submittingLocal ? <span className="animate-spin">⏳</span> : 'Submit Test'}
        </button>
        {!allAnswered && (
          <p className="text-center text-xs text-muted-foreground">
            Answer all {questions.length} questions to submit
          </p>
        )}
      </div>
    </div>
  );
}

export default TestPhase;
