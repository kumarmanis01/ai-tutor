/**
 * FILE OBJECTIVE:
 * - Verify precise day-level age calculation behavior for onboarding age-gate decisions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/calculateAgeFromDob.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T12:00:00Z | copilot | add exact-18 boundary and invalid/future DOB tests
 */

import { calculateAgeFromDob } from '@/lib/student/calculateAgeFromDob';

describe('calculateAgeFromDob', () => {
  it('treats a learner born exactly 18 years ago today as 18', () => {
    const today = new Date('2026-04-27T12:00:00.000Z');
    const age = calculateAgeFromDob('2008-04-27', today);
    expect(age).toBe(18);
  });

  it('treats a learner with 18th birthday tomorrow as 17 today', () => {
    const today = new Date('2026-04-27T12:00:00.000Z');
    const age = calculateAgeFromDob('2008-04-28', today);
    expect(age).toBe(17);
  });

  it('returns null for future DOB values', () => {
    const today = new Date('2026-04-27T12:00:00.000Z');
    const age = calculateAgeFromDob('2030-01-01', today);
    expect(age).toBeNull();
  });
});
