/**
 * Unit tests for usePractice hook (S2.3).
 */

describe('usePractice module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/hooks/usePractice')).not.toThrow();
  });

  it('should export usePractice function as default and named', () => {
    const mod = require('@/hooks/usePractice');
    expect(typeof mod.usePractice).toBe('function');
    expect(typeof mod.default).toBe('function');
  });
});
