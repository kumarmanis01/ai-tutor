/**
 * FILE OBJECTIVE:
 * - Shared interactive question shell for student question surfaces.
 * - Renders a consistent header, prompt, answer controls, and optional graded feedback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/questions/QuestionInteractionShell.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | create shared question interaction shell for practice, test, and homework views
 */

'use client';

import React from 'react';

export interface QuestionShellChoice {
  key: string;
  label: string;
}

interface QuestionInteractionShellProps {
  prompt: string;
  questionNumber: number;
  totalQuestions: number;
  difficulty?: string | null;
  choices?: QuestionShellChoice[];
  value: string;
  onChange: (value: string) => void;
  onTextCommit?: (value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  isCorrect?: boolean;
  correctAnswerLabel?: string | null;
  submittedAnswerLabel?: string | null;
  explanation?: string | null;
  headerAction?: React.ReactNode;
}

const RESULT_STYLES = {
  correct: {
    container: 'bg-[#EAF3DE] border-[#1D9E75]/30',
    heading: 'text-[#1D9E75]',
    title: 'Correct!',
  },
  incorrect: {
    container: 'bg-[#FCEBEB] border-[#E24B4A]/30',
    heading: 'text-[#E24B4A]',
    title: 'Needs review',
  },
} as const;

export function QuestionInteractionShell({
  prompt,
  questionNumber,
  totalQuestions,
  difficulty,
  choices = [],
  value,
  onChange,
  onTextCommit,
  disabled = false,
  showResult = false,
  isCorrect,
  correctAnswerLabel,
  submittedAnswerLabel,
  explanation,
  headerAction,
}: QuestionInteractionShellProps) {
  const hasChoices = choices.length > 0;
  const resultStyle = isCorrect ? RESULT_STYLES.correct : RESULT_STYLES.incorrect;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>
              Question {questionNumber} of {totalQuestions}
            </span>
            {difficulty ? (
              <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{difficulty}</span>
            ) : null}
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">{prompt}</p>
        </div>
        {headerAction}
      </div>

      {hasChoices ? (
        <div className="space-y-2.5">
          {choices.map((choice) => {
            const isSelected = value === choice.key || value === choice.label;
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => onChange(choice.key)}
                disabled={disabled}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  isSelected
                    ? 'border-[#534AB7] bg-[#EEEDFE] text-foreground'
                    : 'border-border hover:border-[#534AB7]/40 hover:bg-[#EEEDFE]/50'
                } ${disabled ? 'cursor-default opacity-90' : ''}`}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase ${
                    isSelected
                      ? 'border-[#534AB7] bg-[#534AB7] text-white'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {choice.key}
                </span>
                <span className="text-foreground">{choice.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            const nextValue = event.target.value.trim();
            if (nextValue.length > 0) {
              onTextCommit?.(nextValue);
            }
          }}
          disabled={disabled}
          placeholder="Type your answer here..."
          className="min-h-[88px] w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/40 disabled:bg-muted/30"
        />
      )}

      {showResult && isCorrect !== undefined ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${resultStyle.container}`}>
          <p className={`font-semibold ${resultStyle.heading}`}>{resultStyle.title}</p>
          {!isCorrect && submittedAnswerLabel ? (
            <p className="mt-1 text-foreground/80">You answered: {submittedAnswerLabel}</p>
          ) : null}
          {!isCorrect && correctAnswerLabel ? (
            <p className="mt-1 text-foreground/80">Correct answer: {correctAnswerLabel}</p>
          ) : null}
          {explanation ? <p className="mt-2 text-foreground/70">{explanation}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export default QuestionInteractionShell;