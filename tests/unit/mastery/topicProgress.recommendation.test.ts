/**
 * FILE OBJECTIVE:
 * - Unit tests for the getRecommendedToughness() pure function in topicProgress.ts.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-3a: initial creation
 */

import { MasteryState } from '@prisma/client';
import { getRecommendedToughness } from '@/lib/mastery/topicProgress';

describe('getRecommendedToughness', () => {
  it('should recommend toughness 3 for zero attempts', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0, attempts: 0 });
    expect(result.toughness).toBe(3);
    expect(result.label).toBe('Easy');
  });

  it('should recommend toughness 3 when TopicProgress is null', () => {
    const result = getRecommendedToughness({ state: null, score: 0, attempts: 0 });
    expect(result.toughness).toBe(3);
    expect(result.label).toBe('Easy');
    expect(result.reason).toBe('Start here');
  });

  it('should recommend toughness 2 for DEVELOPING with score < 0.40', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0.3, attempts: 3 });
    expect(result.toughness).toBe(2);
    expect(result.label).toBe('Easier');
  });

  it('should recommend toughness 4 for DEVELOPING with score >= 0.40 and < 0.70', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0.5, attempts: 4 });
    expect(result.toughness).toBe(4);
    expect(result.label).toBe('Standard');
  });

  it('should recommend toughness 6 for DEVELOPING with score >= 0.70', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0.75, attempts: 5 });
    expect(result.toughness).toBe(6);
    expect(result.label).toBe('Challenge');
  });

  it('should recommend toughness 8 for MASTERED', () => {
    const result = getRecommendedToughness({ state: MasteryState.MASTERED, score: 0.9, attempts: 6 });
    expect(result.toughness).toBe(8);
    expect(result.label).toBe('Challenge');
  });

  it('should treat score exactly 0.40 as Standard band', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0.40, attempts: 2 });
    expect(result.toughness).toBe(4);
  });

  it('should treat score exactly 0.70 as Challenge band', () => {
    const result = getRecommendedToughness({ state: MasteryState.DEVELOPING, score: 0.70, attempts: 2 });
    expect(result.toughness).toBe(6);
  });

  it('should return a reason string for every branch', () => {
    const cases: Parameters<typeof getRecommendedToughness>[0][] = [
      { state: null, score: 0, attempts: 0 },
      { state: MasteryState.DEVELOPING, score: 0, attempts: 0 },
      { state: MasteryState.DEVELOPING, score: 0.2, attempts: 1 },
      { state: MasteryState.DEVELOPING, score: 0.5, attempts: 1 },
      { state: MasteryState.DEVELOPING, score: 0.8, attempts: 1 },
      { state: MasteryState.MASTERED, score: 0.9, attempts: 1 },
    ];
    for (const c of cases) {
      const r = getRecommendedToughness(c);
      expect(typeof r.reason).toBe('string');
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
