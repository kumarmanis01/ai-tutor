/**
 * Unit tests for LearningMap component (S2.1).
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/student/practice/FreemiumWallModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/student/learning-map/ChapterNode', () => ({
  __esModule: true,
  default: () => null,
  ChapterNode: () => null,
}));
jest.mock('@/components/student/learning-map/ChapterInfo', () => ({
  __esModule: true,
  default: () => null,
  ChapterInfo: () => null,
}));

describe('LearningMap module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/LearningMap')).not.toThrow();
  });

  it('should export LearningMap as default and named export', () => {
    const mod = require('@/components/student/learning-map/LearningMap');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.LearningMap).toBe('function');
  });
});
