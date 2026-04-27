/**
 * Unit tests for ChapterInfo component (S2.1).
 */

describe('ChapterInfo module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/ChapterInfo')).not.toThrow();
  });

  it('should export ChapterInfo as default and named export', () => {
    const mod = require('@/components/student/learning-map/ChapterInfo');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.ChapterInfo).toBe('function');
  });
});
