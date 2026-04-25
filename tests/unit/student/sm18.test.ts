/**
 * Unit tests for SM-18 spaced repetition algorithm.
 * F-STU-022 AC-01: Every mastered concept gets a revision due date via SM-18.
 *
 * Tests: lib/ai/tutor/sm18.ts
 */

import {
  computeRetention,
  updateStability,
  computeNextReviewDays,
  updateSM18,
} from '@/lib/ai/tutor/sm18';

describe('computeRetention', () => {
  it('should return 1.0 when elapsedDays <= 0', () => {
    expect(computeRetention(0, 10)).toBe(1.0);
    expect(computeRetention(-1, 10)).toBe(1.0);
  });

  it('should return 0 when stability <= 0', () => {
    expect(computeRetention(5, 0)).toBe(0);
    expect(computeRetention(5, -1)).toBe(0);
  });

  it('should return a value in (0, 1) for positive elapsed and stability', () => {
    const r = computeRetention(7, 10);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });

  it('should decay as elapsed days increase', () => {
    const stability = 14;
    const r1 = computeRetention(1, stability);
    const r7 = computeRetention(7, stability);
    const r14 = computeRetention(14, stability);
    expect(r1).toBeGreaterThan(r7);
    expect(r7).toBeGreaterThan(r14);
  });
});

describe('updateStability', () => {
  it('should increase stability on correct answer', () => {
    const newS = updateStability(10, 0.9, true);
    expect(newS).toBeGreaterThan(10);
  });

  it('should reduce stability on wrong answer', () => {
    const newS = updateStability(10, 0.9, false);
    expect(newS).toBeLessThan(10);
    expect(newS).toBeGreaterThanOrEqual(1); // min 1
  });

  it('should not drop below 1 on wrong answer even with low stability', () => {
    const newS = updateStability(1, 0.1, false);
    expect(newS).toBe(1);
  });
});

describe('computeNextReviewDays', () => {
  it('should return at least 1 day', () => {
    expect(computeNextReviewDays(0)).toBe(1);
    expect(computeNextReviewDays(-5)).toBe(1);
  });

  it('should return at most 180 days', () => {
    expect(computeNextReviewDays(10000)).toBe(180);
  });

  it('should return a longer interval for larger stability', () => {
    const d5 = computeNextReviewDays(5);
    const d20 = computeNextReviewDays(20);
    expect(d20).toBeGreaterThan(d5);
  });

  it('should return a shorter interval for higher targetRetention (pre-exam mode)', () => {
    const normal = computeNextReviewDays(14, 0.9);
    const preExam = computeNextReviewDays(14, 0.92);
    // Higher retention target = shorter interval (student needs more frequent review)
    expect(preExam).toBeLessThanOrEqual(normal);
  });
});

describe('updateSM18', () => {
  it('should return a valid result with positive nextReviewInDays', () => {
    const result = updateSM18({ stability: 5, retention: 0.9, isCorrect: true, elapsedDays: 5 });
    expect(result.nextReviewInDays).toBeGreaterThanOrEqual(1);
    expect(result.newStability).toBeGreaterThan(0);
    expect(result.newRetention).toBeGreaterThan(0);
    expect(result.newRetention).toBeLessThanOrEqual(1);
  });

  it('should produce a shorter interval after a wrong answer', () => {
    const correct = updateSM18({ stability: 10, retention: 0.9, isCorrect: true, elapsedDays: 10 });
    const wrong = updateSM18({ stability: 10, retention: 0.9, isCorrect: false, elapsedDays: 10 });
    expect(wrong.nextReviewInDays).toBeLessThan(correct.nextReviewInDays);
  });

  it('should use pre-exam target retention of 0.92 when passed (AC-07)', () => {
    const normal = updateSM18({ stability: 14, retention: 0.9, isCorrect: true, elapsedDays: 14 });
    const preExam = updateSM18({
      stability: 14,
      retention: 0.9,
      isCorrect: true,
      elapsedDays: 14,
      targetRetention: 0.92,
    });
    expect(preExam.nextReviewInDays).toBeLessThanOrEqual(normal.nextReviewInDays);
  });

  it('should handle non-finite inputs gracefully', () => {
    const result = updateSM18({ stability: NaN, retention: NaN, isCorrect: true, elapsedDays: 0 });
    expect(result.nextReviewInDays).toBeGreaterThanOrEqual(1);
  });
});
