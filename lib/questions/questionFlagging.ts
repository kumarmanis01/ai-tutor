/**
 * FILE OBJECTIVE:
 * - Centralize question-flag UI reasons, storage mapping, and display helpers for student flagging and admin review.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/questions/questionFlagging.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | create shared question flag reason mapping and review-display helpers
 */

const FLAG_REASON_PREFIX = 'Student reason:';
const FLAG_NOTES_PREFIX = 'Notes:';

export const QUESTION_FLAG_REASON_OPTIONS = [
  {
    value: 'INCORRECT',
    label: 'Incorrect',
    storedReason: 'WRONG_ANSWER',
  },
  {
    value: 'DUPLICATE_IN_SESSION',
    label: 'Duplicate within session',
    storedReason: 'OFF_TOPIC',
  },
  {
    value: 'WRONG_ANSWER',
    label: 'Wrong answer',
    storedReason: 'WRONG_ANSWER',
  },
] as const;

export type QuestionFlagUiReason = (typeof QUESTION_FLAG_REASON_OPTIONS)[number]['value'];

function humanizeStoredReason(reason: string): string {
  return reason
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function resolveQuestionFlagReason(reason: string): {
  isValid: boolean;
  storedReason: string | null;
  label: string | null;
} {
  const option = QUESTION_FLAG_REASON_OPTIONS.find((item) => item.value === reason);
  if (option) {
    return {
      isValid: true,
      storedReason: option.storedReason,
      label: option.label,
    };
  }

  const backwardCompatibleOption = QUESTION_FLAG_REASON_OPTIONS.find(
    (item) => item.storedReason === reason || item.value === reason,
  );

  if (backwardCompatibleOption) {
    return {
      isValid: true,
      storedReason: backwardCompatibleOption.storedReason,
      label: backwardCompatibleOption.label,
    };
  }

  return {
    isValid: false,
    storedReason: null,
    label: null,
  };
}

export function buildQuestionFlagDetails(reasonLabel: string, note: string | null | undefined): string {
  const lines = [`${FLAG_REASON_PREFIX} ${reasonLabel}`];
  const trimmedNote = note?.trim();

  if (trimmedNote) {
    lines.push(`${FLAG_NOTES_PREFIX} ${trimmedNote}`);
  }

  return lines.join('\n');
}

export function extractQuestionFlagReasonLabel(details: string | null | undefined, fallbackReason: string): string {
  if (details) {
    const matchedLine = details
      .split('\n')
      .find((line) => line.trim().startsWith(FLAG_REASON_PREFIX));

    if (matchedLine) {
      return matchedLine.replace(FLAG_REASON_PREFIX, '').trim();
    }
  }

  return humanizeStoredReason(fallbackReason);
}

export function extractQuestionFlagNotes(details: string | null | undefined): string | null {
  if (!details) {
    return null;
  }

  const matchedLine = details
    .split('\n')
    .find((line) => line.trim().startsWith(FLAG_NOTES_PREFIX));

  if (!matchedLine) {
    return null;
  }

  const notes = matchedLine.replace(FLAG_NOTES_PREFIX, '').trim();
  return notes.length > 0 ? notes : null;
}