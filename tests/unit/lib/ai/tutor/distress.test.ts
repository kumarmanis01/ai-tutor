import { detectDistress } from '@/lib/ai/tutor/distress';

describe('detectDistress', () => {
  // 1. CRITICAL trigger → correct severity
  test('CRITICAL: "want to disappear" → severity CRITICAL', () => {
    const r = detectDistress('I just want to disappear from everything');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('CRITICAL');
    expect(r.triggerPhrases).toContain('want to disappear');
  });

  // 2. HIGH trigger → correct severity
  test('HIGH: "nobody cares about me" → severity HIGH', () => {
    const r = detectDistress('I feel like nobody cares about me at all');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('HIGH');
    expect(r.triggerPhrases).toContain('nobody cares about me');
  });

  // 3. MEDIUM trigger → correct severity
  test('MEDIUM: "hate myself" → severity MEDIUM', () => {
    const r = detectDistress('I hate myself for not understanding this');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('MEDIUM');
    expect(r.triggerPhrases).toContain('hate myself');
  });

  // 4. "this is too hard" → LOW, not CRITICAL (normal study frustration)
  test('LOW: "this is too hard" → detected LOW, not CRITICAL', () => {
    const r = detectDistress('Ugh this is too hard for me to understand');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('LOW');
  });

  // 5. "what is the answer" → not detected
  test('"what is the answer" → not detected', () => {
    const r = detectDistress('What is the answer to question 3?');
    expect(r.detected).toBe(false);
    expect(r.triggerPhrases).toHaveLength(0);
  });

  // 6. empty string → not detected, no throw
  test('empty string → not detected, never throws', () => {
    expect(() => detectDistress('')).not.toThrow();
    const r = detectDistress('');
    expect(r.detected).toBe(false);
  });

  // 7. mixed message with one trigger → detected at correct severity
  test('mixed message with one CRITICAL trigger → CRITICAL severity', () => {
    const r = detectDistress('I studied hard but I just want to end my life, nothing works');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('CRITICAL');
    expect(r.triggerPhrases).toContain('end my life');
  });

  // 8. case insensitive match
  test('case insensitive: "HURT MYSELF" matches', () => {
    const r = detectDistress('I keep thinking about HURT MYSELF');
    expect(r.detected).toBe(true);
    expect(r.severity).toBe('CRITICAL');
  });

  // 9. message with no keywords → detected=false
  test('message with no keywords → detected false', () => {
    const r = detectDistress('Can you explain how photosynthesis works please?');
    expect(r.detected).toBe(false);
    expect(r.triggerPhrases).toHaveLength(0);
    expect(r.suggestedResponse).toBe('');
  });

  // 10. suggestedResponse present when detected=true
  test('suggestedResponse is non-empty string when detected=true', () => {
    const r = detectDistress('I feel so hopeless about my exams');
    expect(r.detected).toBe(true);
    expect(typeof r.suggestedResponse).toBe('string');
    expect(r.suggestedResponse.length).toBeGreaterThan(0);
  });
});
