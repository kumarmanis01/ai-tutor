/**
 * Unit tests for lib/student/progressReport.ts -- F-STU-033 AC-02.
 *
 * Covers barConfig() and buildBucketCounts() pure helpers.
 */

import { barConfig, buildBucketCounts } from '@/lib/student/progressReport';

describe('barConfig', () => {
  it('should return 7-day config when days=7', () => {
    const cfg = barConfig(7);
    expect(cfg.fetchDays).toBe(7);
    expect(cfg.periodLabel).toBe('last 7 days');
    expect(cfg.labels).toHaveLength(4);
  });

  it('should return 30-day config when days=30', () => {
    const cfg = barConfig(30);
    expect(cfg.fetchDays).toBe(30);
    expect(cfg.periodLabel).toBe('last 30 days');
    expect(cfg.labels[0]).toBe('Week 1');
  });

  it('should return 90-day config when days=90', () => {
    const cfg = barConfig(90);
    expect(cfg.fetchDays).toBe(90);
    expect(cfg.periodLabel).toBe('last 90 days');
  });

  it('should return all-time config when days=0', () => {
    const cfg = barConfig(0);
    expect(cfg.fetchDays).toBe(0);
    expect(cfg.periodLabel).toBe('all time');
  });

  it('should default to 30-day config for unknown values', () => {
    const cfg = barConfig(999);
    expect(cfg.fetchDays).toBe(30);
  });

  it('should always return exactly 4 bar labels', () => {
    for (const d of [7, 30, 90, 0, 14]) {
      expect(barConfig(d).labels).toHaveLength(4);
    }
  });
});

describe('buildBucketCounts', () => {
  const DAY = 86_400_000;

  it('should return [0,0,0,0] for empty session list', () => {
    const cfg = barConfig(30);
    expect(buildBucketCounts([], cfg)).toEqual([0, 0, 0, 0]);
  });

  it('should place session in the most-recent bucket (index 3)', () => {
    const cfg = barConfig(30);
    const now = Date.now();
    // Session from yesterday -- falls in last bucket (most recent week).
    const sessions = [{ startedAt: new Date(now - DAY) }];
    const counts = buildBucketCounts(sessions, cfg, now);
    expect(counts[3]).toBe(1);
    expect(counts[0] + counts[1] + counts[2]).toBe(0);
  });

  it('should place old session in the oldest bucket (index 0)', () => {
    const cfg = barConfig(30);
    const now = Date.now();
    // Session from 29 days ago -- falls in oldest bucket.
    const sessions = [{ startedAt: new Date(now - 29 * DAY) }];
    const counts = buildBucketCounts(sessions, cfg, now);
    expect(counts[0]).toBe(1);
  });

  it('should ignore future-dated sessions', () => {
    const cfg = barConfig(30);
    const now = Date.now();
    const sessions = [{ startedAt: new Date(now + DAY) }];
    const counts = buildBucketCounts(sessions, cfg, now);
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it('should handle all-time (fetchDays=0) with dynamic window', () => {
    const cfg = barConfig(0);
    const now = Date.now();
    // Spread across 100 days.
    const sessions = [
      { startedAt: new Date(now - 100 * DAY) },
      { startedAt: new Date(now - 50 * DAY) },
      { startedAt: new Date(now - 10 * DAY) },
      { startedAt: new Date(now - DAY) },
    ];
    const counts = buildBucketCounts(sessions, cfg, now);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it('should return total matching session count', () => {
    const cfg = barConfig(30);
    const now = Date.now();
    const sessions = Array.from({ length: 9 }, (_, i) => ({
      startedAt: new Date(now - (i + 1) * 3 * DAY),
    }));
    const counts = buildBucketCounts(sessions, cfg, now);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(9);
  });
});
