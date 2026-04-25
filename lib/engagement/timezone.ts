/**
 * Timezone helpers for engagement: student local date from UTC, and UTC ranges for a local date.
 * Uses Intl only (no extra deps). IANA timezone (e.g. Asia/Kolkata).
 */

const DEFAULT_TZ = 'UTC';

/**
 * Returns the calendar date (YYYY-MM-DD) in the given timezone for a UTC instant.
 */
export function getLocalDateString(utcDate: Date, timezone: string | null | undefined): string {
  const tz = timezone ?? DEFAULT_TZ;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(utcDate); // en-CA gives YYYY-MM-DD
}

/**
 * Returns the UTC Date for midnight at the start of the given local date in the given timezone.
 * So "2026-03-08" + "Asia/Kolkata" => UTC instant when it is 2026-03-08 00:00:00 in Kolkata.
 */
export function startOfLocalDayUtc(
  localDateStr: string,
  timezone: string | null | undefined
): Date {
  const tz = timezone ?? DEFAULT_TZ;
  // Noon UTC on that date is always in the same calendar day in any TZ (within reason)
  const noonUtc = new Date(localDateStr + 'T12:00:00.000Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(noonUtc);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const msIntoDay = (hour * 60 + minute) * 60 * 1000;
  return new Date(noonUtc.getTime() - msIntoDay);
}

/**
 * End of local day (exclusive): start of the next calendar day in the same TZ.
 */
export function endOfLocalDayUtc(localDateStr: string, timezone: string | null | undefined): Date {
  const start = startOfLocalDayUtc(localDateStr, timezone);
  const nextDayUtc = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const nextStr = getLocalDateString(nextDayUtc, timezone);
  return startOfLocalDayUtc(nextStr, timezone);
}

/**
 * "Today" in the student's timezone (YYYY-MM-DD).
 */
export function getTodayLocalDateString(timezone: string | null | undefined): string {
  return getLocalDateString(new Date(), timezone);
}
