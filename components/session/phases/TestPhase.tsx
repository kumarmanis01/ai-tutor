'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 4: TEST -- All questions at once, no hints, submit at end.
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

interface TestPhaseProps {
  content: TestContent;
  topicName?: string;
  onSubmit: (
    answers: { questionId: string; answer: string }[]
  ) => Promise<SubmitActionResult | null>;
  onReadyToProceed: (ready: boolean) => void;
  onTestStateChange: (allAnswered: boolean, resultSet: boolean) => void;
  onRegisterTestSubmit: (handler: (() => Promise<void>) | null) => void;
  submitting?: boolean;
}

function TestResults({ result }: { result: SubmitActionResult }) {
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
              r.isCorrect
                ? 'bg-green-500/5 border border-green-500/15'
                : 'bg-orange-500/5 border border-orange-500/15'
            }`}
          >
            <span
              className={`font-bold flex-shrink-0 ${r.isCorrect ? 'text-green-600' : 'text-orange-600'}`}
            >
              {r.isCorrect ? '✓' : '✗'}
            </span>
            <div>
              <span className="text-muted-foreground">Q{i + 1} -- </span>
              {r.isCorrect ? (
                <span className="text-green-700 dark:text-green-400">Correct</span>
              ) : (
                <span>
                  Correct:{' '}
                  <span className="font-medium text-foreground">
                    {r.correctAnswer ?? 'See notes'}
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Primary CTA (Continue) is in SessionFooter */}
    </div>
  );
}

export function TestPhase({
  content,
  topicName: _topicName,
  onSubmit,
  onReadyToProceed: _onReadyToProceed,
  onTestStateChange,
  onRegisterTestSubmit,
  submitting: _submitting,
}: TestPhaseProps) {
  const { questions, isEmpty, answers, setAnswer, allAnswered } = useTestQuestions(content);
  const [result, setResult] = useState<SubmitActionResult | null>(null);
  const [_submittingLocal, setSubmittingLocal] = useState(false);

  const handleSubmit = React.useCallback(async () => {
    setSubmittingLocal(true);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer: answer as string,
    }));
    const res = await onSubmit(payload);
    if (res) setResult(res);
    setSubmittingLocal(false);
  }, [answers, onSubmit]);

  React.useEffect(() => {
    onTestStateChange(allAnswered, !!result);
  }, [allAnswered, result, onTestStateChange]);

  React.useEffect(() => {
    onRegisterTestSubmit(handleSubmit);
    return () => onRegisterTestSubmit(null);
  }, [handleSubmit, onRegisterTestSubmit]);

  if (result) return <TestResults result={result} />;

  if (isEmpty) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
        Test questions are being prepared. Come back shortly.
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,minmax(240px,280px)] gap-6 lg:gap-8 max-w-5xl mx-auto px-4 pb-6">
      <main className="min-w-0 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Quick Test</h1>
        <p className="text-muted-foreground text-sm mb-2">
          Let&apos;s check what you&apos;ve learned.
        </p>

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

        <div className="space-y-6">
          {questions.map((question, i) => {
            const choices = normaliseChoices(question.options);
            const selected = answers[question.id];

            return (
              <div key={question.id} className="bg-card rounded-xl border p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Question {i + 1} of {questions.length}
                </p>
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
                    placeholder="Type your answer..."
                    value={answers[question.id] ?? ''}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
            );
          })}
        </div>

        {!allAnswered && (
          <p className="text-center text-xs text-muted-foreground pt-2">
            Answer all {questions.length} questions to submit (use the footer button)
          </p>
        )}
      </main>
      <aside className="order-first md:order-none md:sticky md:top-24 self-start">
        <TutorTipPanel tipText="Answer all questions, then submit." />
      </aside>
    </div>
  );
}

export default TestPhase;
