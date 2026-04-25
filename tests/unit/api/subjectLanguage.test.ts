/** FILE OBJECTIVE:
 * - Validate `VALID_LANGUAGES` constant used by the student subject-language API.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/subjectLanguage.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-19T12:00:00Z | copilot | deduplicate test and keep single assertion block
 */

import { VALID_LANGUAGES } from '@/app/api/student/subject-language/route';

describe('subject-language VALID_LANGUAGES', () => {
  it('does not include auto and contains en and hi', () => {
    expect(VALID_LANGUAGES).not.toContain('auto');
    expect(VALID_LANGUAGES).toEqual(expect.arrayContaining(['en', 'hi']));
  });
});
