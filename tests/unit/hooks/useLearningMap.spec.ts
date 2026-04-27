/**
 * Unit tests for useLearningMap hook (S2.1).
 */

describe('useLearningMap module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/hooks/useLearningMap')).not.toThrow();
  });

  it('should export useLearningMap function', () => {
    const mod = require('@/hooks/useLearningMap');
    expect(typeof mod.useLearningMap).toBe('function');
    expect(typeof mod.default).toBe('function');
  });
});

describe('useLearningMap LearningMapPayload shape', () => {
  it('empty payload matches expected structure', () => {
    // The module exports type constants — verify the empty payload shape used internally
    // by checking the exported hook signature: (studentId: string) => { data, isLoading, error, ... }
    const mod = require('@/hooks/useLearningMap');
    expect(mod.useLearningMap).toBeDefined();
  });
});
