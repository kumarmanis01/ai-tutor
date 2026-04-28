/**
 * Unit tests for LessonExperience component (S2.2).
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => children }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

describe('LessonExperience module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/LessonExperience')).not.toThrow();
  });

  it('should export default function', () => {
    const mod = require('@/components/student/learning-map/LessonExperience');
    expect(typeof mod.default).toBe('function');
  });
});
