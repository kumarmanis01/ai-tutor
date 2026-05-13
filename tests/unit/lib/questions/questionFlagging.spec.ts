/**
 * FILE OBJECTIVE:
 * - Verify shared question-flagging reason helpers preserve the user-selected reason label for admin review while mapping to stored moderation buckets.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/questions/questionFlagging.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add unit coverage for question flag reason mapping and detail parsing
 */

import {
  buildQuestionFlagDetails,
  extractQuestionFlagNotes,
  extractQuestionFlagReasonLabel,
  QUESTION_FLAG_REASON_OPTIONS,
  resolveQuestionFlagReason,
} from '../../../../lib/questions/questionFlagging';

describe('questionFlagging', () => {
  it('resolves a UI reason into a stored moderation bucket and label', () => {
    expect(resolveQuestionFlagReason('DUPLICATE_IN_SESSION')).toEqual({
      isValid: true,
      storedReason: 'OFF_TOPIC',
      label: 'Duplicate within session',
    });
  });

  it('builds and parses stored detail text', () => {
    const details = buildQuestionFlagDetails('Incorrect', 'Answer key looks wrong');

    expect(extractQuestionFlagReasonLabel(details, 'WRONG_ANSWER')).toBe('Incorrect');
    expect(extractQuestionFlagNotes(details)).toBe('Answer key looks wrong');
  });

  it('falls back to a humanized stored reason when no structured details exist', () => {
    expect(extractQuestionFlagReasonLabel(null, 'WRONG_ANSWER')).toBe('Wrong Answer');
  });

  it('exposes the configured flag reasons for the dialog', () => {
    expect(QUESTION_FLAG_REASON_OPTIONS.map((reason) => reason.value)).toEqual([
      'INCORRECT',
      'DUPLICATE_IN_SESSION',
      'WRONG_ANSWER',
    ]);
  });
});