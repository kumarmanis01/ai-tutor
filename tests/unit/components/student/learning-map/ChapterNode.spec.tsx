/**
 * Unit tests for ChapterNode component (S2.1).
 * Node env: tests pure helper functions only; rendering requires jsdom.
 */

describe('ChapterNode module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/ChapterNode')).not.toThrow();
  });
});

describe('ChapterNode logic', () => {
  it('should export ChapterNode as default and named export', () => {
    const mod = require('@/components/student/learning-map/ChapterNode');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.ChapterNode).toBe('function');
  });
});
