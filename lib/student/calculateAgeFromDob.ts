/**
 * FILE OBJECTIVE:
 * - Provide precise age calculation (to the day) for DOB-based onboarding and consent gates.
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
 * - 2026-04-27T00:00:00Z | copilot | created precise DOB-to-age utility with UTC day-boundary logic
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Returns age in full years, precise to day boundaries.
 * Null when DOB is invalid or unparseable.
 */
export function calculateAgeFromDob(
  dobIso: string,
  today: Date = new Date()
): number | null {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const todayDay = toUtcDay(today);
  const dobDay = toUtcDay(dob);
  if (dobDay > todayDay) {
    return null;
  }

  const todayUtc = new Date(todayDay);
  const dobUtc = new Date(dobDay);

  let age = todayUtc.getUTCFullYear() - dobUtc.getUTCFullYear();
  const monthDelta = todayUtc.getUTCMonth() - dobUtc.getUTCMonth();
  const isBeforeBirthday =
    monthDelta < 0 ||
    (monthDelta === 0 && todayUtc.getUTCDate() < dobUtc.getUTCDate());

  if (isBeforeBirthday) {
    age -= 1;
  }

  return age;
}

export function isAtLeastAge(
  dobIso: string,
  minimumAge: number,
  today: Date = new Date()
): boolean {
  const age = calculateAgeFromDob(dobIso, today);
  return age != null && age >= minimumAge;
}

export function isUnderAge(
  dobIso: string,
  thresholdAge: number,
  today: Date = new Date()
): boolean {
  const age = calculateAgeFromDob(dobIso, today);
  return age != null && age < thresholdAge;
}

export const DATE_MS_PER_DAY = MS_PER_DAY;
