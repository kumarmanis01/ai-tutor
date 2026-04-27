/**
 * Pure helpers for the student progress report page.
 * Extracted to a separate module so unit tests can import without React.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | F-STU-033 AC-02: extracted from page.tsx
 */

export type BarConfig = {
  labels: [string, string, string, string];
  periodLabel: string;
  /** Total days to fetch (0 = no date filter / all-time). */
  fetchDays: number;
};

/** Map days param to chart bar labels + fetch window. */
export function barConfig(days: number): BarConfig {
  if (days === 7) {
    return {
      labels: ['Day 1-2', 'Day 3-4', 'Day 5-6', 'Day 7'],
      periodLabel: 'last 7 days',
      fetchDays: 7,
    };
  }
  if (days === 90) {
    return {
      labels: ['Month 1', 'Month 2', 'Month 3', 'Recent'],
      periodLabel: 'last 90 days',
      fetchDays: 90,
    };
  }
  if (days === 0) {
    return {
      labels: ['Period 1', 'Period 2', 'Period 3', 'Period 4'],
      periodLabel: 'all time',
      fetchDays: 0,
    };
  }
  // default: 30 days / 4 weekly buckets
  return {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    periodLabel: 'last 30 days',
    fetchDays: 30,
  };
}

/** Group sessions into 4 equal-size buckets within the given window. */
export function buildBucketCounts(
  sessions: { startedAt: Date }[],
  cfg: BarConfig,
  now = Date.now(),
): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  if (sessions.length === 0) return counts;

  let windowMs: number;

  if (cfg.fetchDays === 0) {
    // all-time: span from earliest session to now
    const earliest = Math.min(...sessions.map((s) => s.startedAt.getTime()));
    windowMs = Math.max(now - earliest, 1);
  } else {
    windowMs = cfg.fetchDays * 86_400_000;
  }

  const bucketMs = windowMs / 4;

  for (const s of sessions) {
    const ageMs = now - s.startedAt.getTime();
    if (ageMs < 0) continue;
    const bucketIdx = Math.min(3, Math.floor(ageMs / bucketMs)); // 0 = most recent
    counts[3 - bucketIdx]++; // reverse so index 0 = oldest
  }
  return counts;
}
