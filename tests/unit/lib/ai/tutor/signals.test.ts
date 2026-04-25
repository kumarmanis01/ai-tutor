import {
  computeFrustrationScore,
  type TurnHistoryEntry,
  type FrustrationResult,
} from '@/lib/ai/tutor/signals';

function sTurn(partial: Partial<TurnHistoryEntry>): TurnHistoryEntry {
  return {
    role: 'student',
    isCorrect: null,
    hintsRequestedThisTurn: 0,
    negativeLanguageDetected: false,
    responseLatencyMs: 1000,
    ...partial,
  };
}

function aiTurn(partial: Partial<TurnHistoryEntry>): TurnHistoryEntry {
  return {
    role: 'ai',
    isCorrect: null,
    hintsRequestedThisTurn: 0,
    negativeLanguageDetected: false,
    responseLatencyMs: null,
    ...partial,
  };
}

describe('computeFrustrationScore', () => {
  test('Empty history → score 0, NEUTRAL', () => {
    const res = computeFrustrationScore([], null);
    const expected: FrustrationResult = { frustrationScore: 0, emotionalState: 'NEUTRAL' };
    expect(res).toEqual(expected);
  });

  test('1 wrong answer, no hints, no negative language, null baseline', () => {
    const history = [sTurn({ isCorrect: false })];
    const res = computeFrustrationScore(history, null);
    // consecutiveWrong component: 1 wrong -> 0.33; weighted 0.4 => ~0.132
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.12);
    expect(res.frustrationScore).toBeLessThanOrEqual(0.15);
    expect(res.emotionalState).toBe('ENGAGED');
  });

  test('3 consecutive wrong answers include full consecutiveWrong component (0.4)', () => {
    const history = [
      sTurn({ isCorrect: true }),
      sTurn({ isCorrect: false }),
      sTurn({ isCorrect: false }),
      sTurn({ isCorrect: false }),
    ];
    const res = computeFrustrationScore(history, null);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.4);
  });

  test('3 hints used across history → hintsUsed component = 0.20', () => {
    const history = [
      sTurn({ isCorrect: true, hintsRequestedThisTurn: 1 }),
      sTurn({ isCorrect: false, hintsRequestedThisTurn: 2 }),
    ];
    const res = computeFrustrationScore(history, null);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.2);
  });

  test('All student turns have negative language → negativeLanguage component = 0.30', () => {
    const history = [
      sTurn({ isCorrect: false, negativeLanguageDetected: true }),
      sTurn({ isCorrect: true, negativeLanguageDetected: true }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.3);
  });

  test('High latency (3× baseline) → latencyRatio component capped at 0.10', () => {
    const history = [
      sTurn({ isCorrect: true, responseLatencyMs: 3000 }),
      sTurn({ isCorrect: true, responseLatencyMs: 3000 }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.1);
  });

  test('Score >= 0.75 → FRUSTRATED', () => {
    const history = [
      sTurn({
        isCorrect: false,
        negativeLanguageDetected: true,
        hintsRequestedThisTurn: 1,
        responseLatencyMs: 5000,
      }),
      sTurn({
        isCorrect: false,
        negativeLanguageDetected: true,
        hintsRequestedThisTurn: 1,
        responseLatencyMs: 5000,
      }),
      sTurn({
        isCorrect: false,
        negativeLanguageDetected: true,
        hintsRequestedThisTurn: 1,
        responseLatencyMs: 5000,
      }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.75);
    expect(res.emotionalState).toBe('FRUSTRATED');
  });

  test('Score 0.45–0.74 → CONFUSED', () => {
    const history = [
      // Earlier correct turn, no negativity
      sTurn({
        isCorrect: true,
        hintsRequestedThisTurn: 0,
        negativeLanguageDetected: false,
        responseLatencyMs: 800,
      }),
      // Two trailing wrong answers, some hints, one with negative language
      sTurn({
        isCorrect: false,
        hintsRequestedThisTurn: 1,
        negativeLanguageDetected: true,
        responseLatencyMs: 1200,
      }),
      sTurn({
        isCorrect: false,
        hintsRequestedThisTurn: 1,
        negativeLanguageDetected: false,
        responseLatencyMs: 1200,
      }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0.45);
    expect(res.frustrationScore).toBeLessThan(0.75);
    expect(res.emotionalState).toBe('CONFUSED');
  });

  test('Score < 0.20 and no negative language → ENGAGED', () => {
    const history = [
      sTurn({ isCorrect: true, responseLatencyMs: 800 }),
      sTurn({ isCorrect: true, responseLatencyMs: 900 }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeLessThan(0.2);
    expect(res.emotionalState).toBe('ENGAGED');
  });

  test('Negative language present but score < 0.45 → CONFUSED (language override)', () => {
    const history = [
      sTurn({ isCorrect: true, negativeLanguageDetected: true }),
      sTurn({ isCorrect: true, negativeLanguageDetected: false }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBeLessThan(0.45);
    expect(res.emotionalState).toBe('CONFUSED');
  });

  test('sessionBaselineLatencyMs = null → latency component = 0', () => {
    const history = [
      sTurn({ isCorrect: true, responseLatencyMs: 5000 }),
      sTurn({ isCorrect: true, responseLatencyMs: 5000 }),
    ];
    const res = computeFrustrationScore(history, null);
    // No other drivers, so score should be 0
    expect(res.frustrationScore).toBe(0);
  });

  test('frustrationScore always clamped to [0.0, 1.0] even with extreme inputs', () => {
    const history = Array.from({ length: 20 }, () =>
      sTurn({
        isCorrect: false,
        hintsRequestedThisTurn: 10,
        negativeLanguageDetected: true,
        responseLatencyMs: 1_000_000,
      })
    );
    const res = computeFrustrationScore(history, 1);
    expect(res.frustrationScore).toBeGreaterThanOrEqual(0);
    expect(res.frustrationScore).toBeLessThanOrEqual(1);
  });

  test('DISTRESSED never returned regardless of inputs', () => {
    const history = Array.from({ length: 10 }, () =>
      sTurn({
        isCorrect: false,
        hintsRequestedThisTurn: 1,
        negativeLanguageDetected: true,
        responseLatencyMs: 10_000,
      })
    );
    const res = computeFrustrationScore(history, 100);
    expect(res.emotionalState).not.toBe('DISTRESSED');
  });

  test('AI-only turns in history ignored in all components', () => {
    const history = [
      aiTurn({}),
      aiTurn({ negativeLanguageDetected: true }),
      aiTurn({ responseLatencyMs: 9999 as any }),
    ];
    const res = computeFrustrationScore(history, 1000);
    expect(res.frustrationScore).toBe(0);
    expect(res.emotionalState).toBe('NEUTRAL');
  });
});
