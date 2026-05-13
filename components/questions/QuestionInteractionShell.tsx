/**
 * FILE OBJECTIVE:
 * - Shared interactive question shell for student question surfaces.
 * - Renders a consistent header, prompt, answer controls, optional graded feedback, and a shared question-flag workflow.
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
 * - 2026-05-13T00:00:00Z | copilot | add shared question flag dialog so practice, test, and homework inherit one reporting flow
 */

'use client';

import React from 'react';
import { Flag } from 'lucide-react';
import {
  QUESTION_FLAG_REASON_OPTIONS,
  type QuestionFlagUiReason,
} from '@/lib/questions/questionFlagging';

export interface QuestionShellChoice {
  key: string;
  label: string;
}

interface QuestionInteractionShellProps {
  questionId?: string;
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
  onFlagged?: () => void;
}

const FLAG_BUTTON_LABEL = 'Flag question';
const FLAG_CANCEL_LABEL = 'Cancel';
const FLAG_SUBMIT_LABEL = 'Send for review';
const FLAG_MODAL_TITLE = 'Report this question';
const FLAG_MODAL_COPY = 'Flagged questions move into review immediately and are hidden from the student queue until an admin approves or rejects them.';
const FLAG_TEXTAREA_LABEL = 'Optional details';
const FLAG_TEXTAREA_PLACEHOLDER = 'Add a short note to help the reviewer.';
const FLAG_SUCCESS_MESSAGE = 'This question has been sent for review.';
const FLAG_ERROR_MESSAGE = 'Could not send this question for review. Try again.';

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
  questionId,
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
  onFlagged,
}: QuestionInteractionShellProps) {
  const hasChoices = choices.length > 0;
  const resultStyle = isCorrect ? RESULT_STYLES.correct : RESULT_STYLES.incorrect;
  const [isFlagDialogOpen, setIsFlagDialogOpen] = React.useState(false);
  const [selectedFlagReason, setSelectedFlagReason] = React.useState<QuestionFlagUiReason>(
    QUESTION_FLAG_REASON_OPTIONS[0]?.value ?? 'INCORRECT',
  );
  const [flagNotes, setFlagNotes] = React.useState('');
  const [isSubmittingFlag, setIsSubmittingFlag] = React.useState(false);
  const [flagError, setFlagError] = React.useState<string | null>(null);
  const [flagSuccessMessage, setFlagSuccessMessage] = React.useState<string | null>(null);
  const canFlagQuestion = Boolean(questionId);

  async function submitFlag() {
    if (!questionId || isSubmittingFlag) {
      return;
    }

    setIsSubmittingFlag(true);
    setFlagError(null);

    try {
      const response = await fetch(`/api/student/question/${questionId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedFlagReason,
          details: flagNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('flag_failed');
      }

      setFlagSuccessMessage(FLAG_SUCCESS_MESSAGE);
      setIsFlagDialogOpen(false);
      onFlagged?.();
    } catch {
      setFlagError(FLAG_ERROR_MESSAGE);
    } finally {
      setIsSubmittingFlag(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {headerAction}
          {canFlagQuestion ? (
            <button
              type="button"
              onClick={() => {
                setFlagError(null);
                setIsFlagDialogOpen(true);
              }}
              disabled={Boolean(flagSuccessMessage)}
              aria-label={FLAG_BUTTON_LABEL}
              title={FLAG_BUTTON_LABEL}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#E24B4A]/40 hover:bg-[#FCEBEB] hover:text-[#E24B4A] disabled:cursor-default disabled:opacity-70"
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {flagSuccessMessage ? (
        <div className="rounded-xl border border-[#BA7517]/25 bg-[#FAEEDA] px-4 py-3 text-sm text-[#8A5A12]">
          {flagSuccessMessage}
        </div>
      ) : null}

      {flagError ? (
        <div className="rounded-xl border border-[#E24B4A]/25 bg-[#FCEBEB] px-4 py-3 text-sm text-[#A43635]">
          {flagError}
        </div>
      ) : null}

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

      {isFlagDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{FLAG_MODAL_TITLE}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{FLAG_MODAL_COPY}</p>
            </div>

            <div className="mt-4 space-y-2">
              {QUESTION_FLAG_REASON_OPTIONS.map((reasonOption) => (
                <label
                  key={reasonOption.value}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-foreground transition-colors hover:border-[#534AB7]/40 hover:bg-[#EEEDFE]/40"
                >
                  <input
                    type="radio"
                    name="question-flag-reason"
                    value={reasonOption.value}
                    checked={selectedFlagReason === reasonOption.value}
                    onChange={() => setSelectedFlagReason(reasonOption.value)}
                    className="h-4 w-4 accent-[#534AB7]"
                  />
                  <span>{reasonOption.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor={`flag-notes-${questionNumber}`}>
                {FLAG_TEXTAREA_LABEL}
              </label>
              <textarea
                id={`flag-notes-${questionNumber}`}
                rows={3}
                value={flagNotes}
                onChange={(event) => setFlagNotes(event.target.value)}
                placeholder={FLAG_TEXTAREA_PLACEHOLDER}
                className="min-h-[96px] w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]/40"
              />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsFlagDialogOpen(false)}
                className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {FLAG_CANCEL_LABEL}
              </button>
              <button
                type="button"
                onClick={submitFlag}
                disabled={isSubmittingFlag}
                className="min-h-[44px] rounded-xl bg-[#E24B4A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#C93F3E] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingFlag ? 'Sending...' : FLAG_SUBMIT_LABEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default QuestionInteractionShell;